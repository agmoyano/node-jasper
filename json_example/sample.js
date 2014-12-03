
var fs = require('fs');


var jasper = require(__dirname + '/../node-jasper')({
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
        data: { sample_parameter: 'I am a parameter of the report' },
        dataset: { sample_field: 'I am a field from a dataset' }
    }, 'pdf');
        
    fs.writeFile(__dirname + '/sample.pdf', r);
});

    

