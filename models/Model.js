var Stream = require('stream');
var util = require("util");
var _ = require('underscore');
var client = require('./client');

var Model = function(table, fields) {
    this.table = table;
    this.fields = fields;

    var self = this;

    // set up the stored procedure for getById
    client.query({
        name: this.table + 'getById',
        text: util.format('SELECT * FROM %s WHERE id=$1', this.table),
        values: [0]
    });

    self.get = function(id) {
        return self.queryToStream(client.query({
            name: self.table + 'getById',
            values: [id]
        }));
    };

    var INSERT_QUERY = util.format(
        'INSERT INTO %s (%s) VALUES (%s)',
        self.table,
        self.fields.join(', '),
        _.range(1, self.fields.length+1).map(function(num){ return "$"+num; }).join(", ")
    );

    // returns the correct fields in the correct order for the INSERT_QUERY
    function formatForInsert(data) {
        var res = [];
        self.fields.forEach(function(field) {
            res.push(data[field] || null);
        });
        return res;
    }

    var INSERT_ID_QUERY = util.format("SELECT currval(pg_get_serial_sequence('users', 'id')) as id", this.table);

    self.new = function(data) {
        var res = new Stream();
        res.readable = true;
        res.writeable = true;

        var query = client.query(INSERT_QUERY, formatForInsert(data));

        console.log(query);

        query.on('error', function(err) {
            res.emit('error', err);
        });

        query.on('end', function(result) {
            if (!result || !result.rowCount) {
                res.emit('error', 'Post was not saved');
                res.emit('end');
            } else {
                self.queryToStream(client.query(INSERT_ID_QUERY))
                    .on('data', function(data) { res.emit('data', data); })
                    .on('error', function(err) { res.emit('error', err); });
            }
        });

        return res;
    };

    self.update = function(id, data) {

    };

};

module.exports = Model;

Model.prototype.queryToStream = function(query) {
    var res = new Stream();
    res.readable = true;
    res.writeable = false;

    query.on('row', function(row) {
        res.emit('data',row);
    });

    query.on('error', function(err) {
        res.emit('error', err);
    });

    query.on('end', function(result) {
        if(result && result.rowCount == 0) {
            res.emit('error', new NoRowsError())
        }
        res.emit('end', result);
    });

    return res;
};

Model.prototype.NoRowsError = function() {
    Error.call(this, "No rows returned");
};
Model.prototype.NoRowsError.prototype = new Error();


