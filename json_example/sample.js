
console.log('cargando jasper!');

var fs = require('fs');


var jasper = require(__dirname + '/../node-jasper')({
    path: __dirname + '/lib/jasperreports-5.6.1/',
    reports: {
        "stock_ofertas": {
            jasper: __dirname + '/reports/test.jasper',
            jrxml: __dirname + '/reports/test.jrxml',
            conn: 'in_memory_json'
        }
    }
});

jasper.ready(function () {
    
    console.log('ahora puedo usarlo!');
        
    var r = jasper.export({
        report: 'stock_ofertas',
        data: { sample_parameter: 'I am a parameter of the report' },
        dataset: { sample_field: 'I am a field from a dataset' }
    }, 'pdf');
        
    fs.writeFile(__dirname + '/test.pdf', r);
});

    

