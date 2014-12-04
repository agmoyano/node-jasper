
var fs = require('fs');


var jasper = require('../../node-jasper')({
    path: __dirname + '/lib/jasperreports-5.6.1/',
    reports: {
        "stock_ofertas": {
            jasper: __dirname + '/sample.jasper',
            jrxml: __dirname + '/sample.jrxml',
            conn: 'in_memory_json'
        }
    }
});

jasper.ready(function () {
    
        
    var r = jasper.export({
        report: 'stock_ofertas',
        data: { language: 'spanish' },
        dataset: [{ 
		name: 'Gonzalo',
		lastname: 'Vinas' // TODO: check on UTF-8 
	}, {
		name: 'Agustin',
		lastname: 'Moyano'
        }]
    }, 'pdf');
        
    fs.writeFile(__dirname + '/sample.pdf', r);
});

    

