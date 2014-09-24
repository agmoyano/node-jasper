var java = require('java'),
	fs = require('fs'),
	path = require('path'),
	extend = require('extend'),
	util = require('util'),
	temp = require('temp'),
	async = require('async');

var defaults = {reports:{}, drivers:{}, conns:{}};

function walk(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};
	
/*
 * options: {
 * 	path: , //Path to jasperreports-x.x.x-project directory
 * 	reports: {
 * 		// Report Definition
 * 		"name": { 
 * 			jasper: , //Path to jasper file,
 * 			jrxml: , //Path to jrxml file,
 * 			conn: , //Connection name, definition object or false (if false defaultConn won't apply)
 * 		}
 * 	},
 * 	drivers: {
 *		// Driver Definition
 * 		"name": {
 			path: , //Path to jdbc driver jar
 			class: , //Class name of the driver (what you would tipically place in "Class.forName()" in java)
 			type: //Type of database (mysql, postgres)
 		}
 * 	},
 * 	conns: {
 *		// Connection Definition
 * 		"name": {
 * 			host: , //Database hostname or IP
 * 			port: , //Database Port
 * 			dbname: , //Database Name
 * 			user: , //User Name
 * 			pass: , //User Password
 *			driver: //name or definition of the driver for this conn			
 * 		}
 *	},
 *	defaultConn: //Default Connection name	
 * }
 */
function jasper(options) {
	var self = this;
	var parentPath = path.dirname(module.parent.filename);
	var jrPath = path.resolve(parentPath, options.path||'.');
	async.auto({
		jrJars: function(cb) {
			if(fs.statSync(path.join(jrPath, 'lib')).isDirectory() && fs.statSync(path.join(jrPath, 'dist')).isDirectory()) {
				async.parallel([
					function(cb) {
						walk(path.join(jrPath, 'dist'), function(err, results) {
							cb(err, results);
						});
					},
					function(cb) {
						walk(path.join(jrPath, 'lib'), function(err, results) {
							cb(err, results);
						});
					}
				], function(err, results) {
					if(err) return cb(err);
					var r = results.shift();
					results.forEach(function(item) {
						r = r.concat(item);
					});
					cb(null, r);
				})
			} else {
				walk(jrPath, function(err, results) {
					cb(err, results);
				});
			}
		},
		dirverJars: function(cb) {
			var results = [];
			if(options.drivers) {
				for(var i in options.drivers) {
					results.push(path.resolve(parentPath, options.drivers[i].path));
				}
			}
			cb(null, results);
		},
		loadJars: ['jrJars', 'dirverJars', function(cb, jars) {
			jars.jrJars.concat(jars.dirverJars).forEach(function(file) {
				if(path.extname(file) == '.jar') {
					java.classpath.push(file)
				}
			});
			cb();
		}],
		loadClass: ['loadJars', function(cb) {
			var cl = java.callStaticMethodSync("java.lang.ClassLoader","getSystemClassLoader")
			for(var i in options.drivers) {
				cl.loadClassSync(options.drivers[i].class).newInstanceSync();
			}
		}]
	});

	delete options.path;
	extend(self, defaults, options);
}

/*
 * name = Report Name
 * def = Report Definition
 */
jasper.prototype.add = function(name, def) {
	this.reports[name] = def;
}

jasper.prototype.pdf = function(report) {
  return this.export(report, 'pdf');
}

/*
 * report can be of any of the following types:
 * _ A string that represents report's name. No data is supplied.. defaultConn will be applied to get data with reports internal query.
 * _ An object that represents report's definition. No data is supplied.. defaultConn will be applied to get data with reports internal query.
 * _ An object that represents reports, data and properties to override for this specific method call.
 *	
 * 	{
 * 		report: , //name, definition or an array with any combination of both
 * 		data: {}, //Data to be applied to the report. If there is an array of reports, data will be applied to each.
 * 		override: {} //properties of report to override for this specific method call.
 * 	} 
 * _ An array with any combination of the three posibilities described before. 
 * _ A function returning any combination of the four posibilities described before.
 */

jasper.prototype.export = function(report, type) {
	
	var self = this;

	if(!type) return;

	type = type.charAt(0).toUpperCase()+type.toLowerCase().slice(1);

	var processReport = function(report) {
		if(typeof report == 'string') {
			return [self.reports[report]];
		} else if(util.isArray(report)) {
			var ret = [];
			report.forEach(function(i) {
				ret.concat(processReport(i));
			});
			return ret;
		} else if(typeof report == 'function') {
			return processReport(report());
		} else if(typeof report == 'object') {
			if(report.data||report.override) {
				var ret = [];
				var reps = processReport(report.report);
				return reps.map(function(i) {
					if(report.override) {
						extend(i, report.override);
					}
					i.data = report.data;
					return i;
				})
			} else {
				return [report];
			}
		}
	};

	var processConn = function(conn) {
		if(typeof conn == 'string') {
			conn = self.conns[conn];
		} else if (typeof conn == 'function') {
			conn = conn();
		} else if(conn !== false && self.defaultConn) {
			conn = self.conns[self.defaultConn];
		}

		if(conn) {
			if(typeof conn.driver == 'string') {
				conn.driver = self.drivers[conn.driver];
			}

			//java.callStaticMethodSync('java.lang.Class', 'forName', conn.driver.class)
			return java.callStaticMethodSync('java.sql.DriverManager', 'getConnection', 'jdbc:'+conn.driver.type+'://'+conn.host+':'+conn.port+'/'+conn.dbname, conn.user, conn.pass)

		} else {
			self.cl.loadClassSync('net.sf.jasperreports.engine.JREmptyDataSource').newInstanceSync();
			return java.newInstanceSync('net.sf.jasperreports.engine.JREmptyDataSource');
		}
		
	};

	var reports = processReport(report);
	var prints = [];
	reports.forEach(function(item) {
		if(!item.jasper && item.jrxml) {
			var name = path.basename(item.jrxml, '.jrxml');
			var file = '/tmp/'+name+'.jasper';
			var compiler = java.newInstanceSync("net.sf.jasperreports.engine.JasperCompileManager");
			compiler.compileReportToFileSync(item.jrxml, file);
			item.jasper = file;
		}

		if(item.jasper) {
			var data = null;
			if(item.data) {
				data = java.newInstanceSync("java.util.HashMap");
				for(var j in item.data) {
					data.putSync(j, item.data[j])
				}
			}

			var conn = processConn(item.conn);
			var p = java.callStaticMethodSync("net.sf.jasperreports.engine.JasperFillManager", "fillReport", item.jasper, data, conn);
			prints.push(p);
		}
	});
	if(prints.length) {
		var master = prints.shift();
		prints.forEach(function(p) {
			var s = p.getPagesSync().sizeSync();
			for(var j = 0; j < s; j++) {
				master.addPageSync(p.getPagesSync().getSync(j));
			}
		});
		var tempName = temp.path({suffix: '.pdf'});
		java.callStaticMethodSync("net.sf.jasperreports.engine.JasperExportManager", 'exportReportTo'+type+'File', master, tempName);
		var exp = fs.readFileSync(tempName);
		fs.unlinkSync(tempName);
		return exp;		
	}
	return '';
}

module.exports = function(options) {
	return new jasper(options)
};