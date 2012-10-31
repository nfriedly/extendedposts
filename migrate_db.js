#!/usr/bin/env node

// based on https://gist.github.com/1557375 by https://github.com/voodootikigod

// load configuration data for the specified environment
var config = require("./config.js");

// load postgresql library
var postgres = require("pg");

// load FS library to handle migration creation and processing
var fs = require("fs");

var APP_ROOT = __dirname + "/";

// set up the migrations directory
var migrations_dir = APP_ROOT+"migrations/";

// excellent library for managing async operations
var async = require('async');

//for execing
var exec = require("child_process").exec;

// if requested with no parameters
if (process.argv.length == 2) {

    // create and connect db
    var db = new postgres.Client(config.DB_URL);
    db.connect();

    // get all already executed migrations.
    db.query('SELECT "version" FROM "schema_migration"', function (err, resp) {
        var migrations_run = 0;
        var executed = [];

        // if there is an error assume we are at the default state, and run root migration
        if (err) {
            console.log("Creating initial schema");

            // attempt to run file located at APP_ROOT/migrations/schema/root.sql to set up the initial schema / data
            var schema = fs.readFileSync(migrations_dir+"schema/root.sql").toString();
            db.query(schema, function(err2) {
                err && console.error("Error creating initial schema", err2, "\n\nPrevious error reading from schema_migration ", err);
            });

        } else {
            // if no error, dump all versions into an array called executed for quick searching.
            for (var rl = resp.rows.length; rl >0; rl--) {
                executed.push(resp.rows[rl-1].version);
            }
        }

        // populate all existing migrations by reading the migrations directory
        fs.readdir(migrations_dir, function (err, list) {
            var migrations = [];
            for (var li = 0, ll = list.length; li < ll; li++) {
                // if the file has a .sql extension, load it as a file read for sql schema updating
                if (m = list[li].match(/(.*)\.sql/)) {
                    migrations.push({
                        id: m[1],
                        sql: fs.readFileSync(migrations_dir+m[0]).toString()
                    });

                    // if the file has a .js extension, load via require system and set js attribute as .migrate function
                } else if (j = list[li].match(/(.*)\.js/)) {
                    migrations.push({
                        id: j[1],
                        js: require(migrations_dir+"/"+list[li]).migrate
                    });
                }
            }

            console.log("" + migrations.length + " migrations found");

            // filter out the migrations we've already applied to the DB
            migrations = migrations.filter(function(migration) {
                return executed.indexOf(migration.id) < 0;
            });

            //sort migrations by id (timestamp) in ascending order - run the oldest ones first
            migrations = migrations.sort(function (a, b) {
                return ( parseInt(b.id) - parseInt(a.id));
            });


            console.log("" + migrations.length + " migrations need executed");

            async.forEachSeries(migrations, function(migration, callback) {
                // alert of execution
                console.log("Executing migration: "+migration.id);

                async.series([
                    // run the migration
                    function(callback) {
                        // check if migration is SQL
                        if (migration.sql) {
                            console.log('executing sql');
                            db.query(migration.sql, callback);
                        } else if (migration.js) {
                            console.log('executing js');
                            // pass our db object and execute it
                            migration.js(db, callback);
                        } else {
                            // if no idea what to do, just skip!
                            console.warn("Unrecognized migration format, skipping.", migration);
                            callback();
                        }
                    },
                    // and update the schema_migration table
                    function(callback) {
                        console.log('updating schema_migration table');
                        db.query("INSERT INTO schema_migration VALUES ($1)", [migration.id], callback);
                    }
                ], function (e) {
                    if (e) {
                        // if error, dump why we couldn't migrate and process no more.
                        console.error("Could not migrate database. Error provided below.");
                        console.error(e);
                        db.end();
                    } else {
                        console.log("done.");
                        // otherwise add to counter and run the rest of the "torun" array
                        migrations_run++;
                        callback();
                    }
                });
            }, function(err){
                if (err) {
                    console.error(err);
                } else {
                    migrations.length && console.log("All migrations completed successfully!");
                }
                db.end();
                process.exit(err ? 1 : 0);
            });
        });
    });

// if provided a generate argument: ./script/migrate generate or ./script/migrate -g
} else if (process.argv[2] == "generate" || process.argv[2] == "-g") {
    // create new file name as the current timestamp
    filename = +(new Date());

    // if final argument was "js"
    if (process.argv[3] == "js") {
        // make a JS file and open it with the default EDITOR pre-populated with the rough boilerplate required.
        filename = migrations_dir+filename+".js";
        exec("echo 'module.exports.migrate = function(db, callback) {\n}' > "+filename+"; edit "+filename);
    } else {
        // make a SQL file and open it with the default EDITOR
        filename = migrations_dir+filename+".sql";
        exec("edit "+filename);
    }
}
