var fs = require('fs');

var jasper = require('../../node-jasper')({
    path: __dirname + '/lib/jasperreports-5.6.1/',
    reports: {
        stock_ofertas: {
            jasper: __dirname + '/sample.jasper',
            jrxml: __dirname + '/sample.jrxml',
            conn: 'in_memory_json'
        }
    }
});

jasper.ready(function() {
    var r = jasper.export(
        {
            report: 'stock_ofertas',
            data: {
                language: 'spanish',
                // on jasper make a parameter named "dataset2" and use on a subreport:
                // ((net.sf.jasperreports.engine.data.JsonDataSource)$P{dataset2})
                dataset2: jasper.toJsonDataSource(
                    {
                        dados: [{ value: 1, value: 2 }]
                    },
                    'dados'
                )
            },
            dataset: [
                {
                    name: 'Gonzalo',
                    lastname: 'Vinas' // TODO: check on UTF-8
                },
                {
                    name: 'Agustin',
                    lastname: 'Moyano'
                }
            ]
        },
        'pdf'
    );

    fs.writeFile(__dirname + '/sample.pdf', r);
});
