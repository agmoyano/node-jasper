# node-jasper

JasperReports within Node.js

## Install

Install via npm:

```
npm install --save node-jasper
```

To use it inside your project just do:

```
var jasper = require('node-jasper')(options);
```

Where _options_ is an object with the following signature:

```
options: {
	path: , //Path to jasperreports-x.x.x directory (from jasperreports-x.x.x-project.tar.gz)
	reports: {
 		// Report Definition
 		"name": {
 			jasper: , //Path to jasper file,
 			jrxml: , //Path to jrxml file,
 			conn: , //Connection name, definition object or false (if false defaultConn won't apply or if ´in_memory_json´ then you can pass an JSON object in the ´dataset´ property for in-memory data sourcing instead of database access

 		}
 	},
 	drivers: {
 		// Driver Definition
 		"name": {
 			path: , //Path to jdbc driver jar
 			class: , //Class name of the driver (what you would tipically place in "Class.forName()" in java)
 			type: //Type of database (mysql, postgres)
 		}
 	},
 	conns: {
 		// Connection Definition
 		"name": {
 			host: , //Database hostname or IP
 			port: , //Database Port
 			dbname: , //Database Name
 			user: , //User Name
 			pass: , //User Password
 			jdbc: , //jdbc connection String. If this is defined, every thing else but user and pass becomes optional.
 			driver: //name or definition of the driver for this conn
 		}
 	},
 	defaultConn: ,//Default Connection name
	java: ,//Array of java options, for example ["-Djava.awt.headless=true"]
	javaInstnace: //Instance of node-java, if this is null, a new instance will be created and passed in 'java' property
 }
 ```

## API

* **java**

	Instance of *node-java* that we are currently running.

* **add(name, report)**

  Add a new _report_ definition identified by _name_.

  In report definition one of _jasper_ or _jrxml_ must be present.

* **pdf(report)**

  Alias for _export(report, 'pdf')_

* **export(report, format)**

  Returns the compiled _report_ in the specified _format_.

  report can be of any of the following types:

  * A string that represents report's name. No data is supplied.. _defaultConn_ will be applied to get data with reports internal query.

  * An object that represents report's definition. No data is supplied.. if _conn_ is not present, then _defaultConn_ will be applied to get data with reports internal query.

  * An object that represents reports, data and properties to override for this specific method call.

    ```
    {
      report: , //name, definition or an array with any combination of both
      data: {}, //Data to be applied to the report. If there is an array of reports, data will be applied to each.
      override: {} //properties of report to override for this specific method call.
      dataset: {} //an object to be JSON serialized and passed to the Report as fields instead of parameters (see the example for more info)
	  query: '' // string to pass to jasperreports to query on the dataset
 	}
 	```
  * An array with any combination of the three posibilities described before.

  * A function returning any combination of the four posibilities described before.

## Example

```
var express = require('express'),
	app = express(),
	jasper = require('node-jasper')({
		path: 'lib/jasperreports-5.6.0',
		reports: {
			hw: {
				jasper: 'reports/helloWorld.jasper'
			}
		},
		drivers: {
			pg: {
				path: 'lib/postgresql-9.2-1004.jdbc41.jar',
				class: 'org.postgresql.Driver',
				type: 'postgresql'
			}
		},
		conns: {
			dbserver1: {
				host: 'dbserver1.example.com',
				port: 5432,
				dbname: 'example',
				user: 'johnny',
				pass: 'test',
				driver: 'pg'
			}
		}
		defaultConn: 'dbserver1'
	});

	app.get('/pdf', function(req, res, next) {
		//beware of the datatype of your parameter.
		var report = {
			report: 'hw',
			data: {
				id: parseInt(req.query.id, 10)
				secundaryDataset: jasper.toJsonDataSource({
					data: ...
				},'data')
			}
			dataset: //main dataset
		};
		var pdf = jasper.pdf(report);
		res.set({
			'Content-type': 'application/pdf',
			'Content-Length': pdf.length
		});
		res.send(pdf);
	});

	app.listen(3000);
```

That's It!.
