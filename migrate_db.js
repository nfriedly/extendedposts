#!/usr/bin/env node

// based on https://gist.github.com/1557375 by https://github.com/voodootikigod

// load configuration data for the specified environment
var config = require("./config.js");

// load postgresql library
var postgres = require("pg").native;

// load FS library to handle migration creation and processing
var fs = require("fs");

var APP_ROOT = __dirname + "/";

// set up the migrations directory
var migrations_dir = APP_ROOT+"migrations/";

//for execing
var exec = require("child_process").exec;

// if requested with no parameters
if (process.argv.length == 2) {

  // create and connect db
  var db = new postgres.Client(config.DB_URL);
  db.connect();

  // function used to migrate the through all of the defined migrations, skipping over those already done.
  function migrate (cb) {

    // get all already executed migrations.
    db.query('SELECT "version" FROM "schema_migrations"', function (err, resp) {
      var migrations_run = 0;
      var executed = [];

      // if there is an error assume we are at the default state, and run root migration
      if (err) {

        // attempt to run file located at APP_ROOT/migrations/schema/root.sql -- good for previous data force load (e.g. Rails)
        var schema = fs.readFileSync(migrations_dir+"schema/root.sql").toString();
        db.query(schema); // populate with root schema if not populated.

      } else {
        // if no error, dump all versions into an array called executed for quick searching.
        for (var rl = resp.rows.length; rl >0; rl--) {
          executed.push(resp.rows[rl-1].version);
        }
      }


      // function loop to execute through the remainin "torun" migrations
      var run_migrations = (function (torun) {

        // get the next migration
        var current = torun.pop();

        // if there is a migration
        if (current) {

          // test if already executed
          if (executed.indexOf(current.id) < 0) {
            // alert of execution
            console.log("Executing migration: "+current.id);

            // check if migration is SQL
            if (current.sql) {

              // suffix with schema migrations insertion so we dont run again if successful.
              var sql = current.sql+"; INSERT INTO schema_migrations VALUES ("+current.id+");";

              // execute the full query
              db.query(sql, function (e, r) {
                if (e) {

                  // if error, dump why we couldn't migrate and process no more.
                  console.log("Could not migrate database. Error provided below.");
                  console.log(e);
                  db.end();
                } else {

                  // otherwise add to counter and run the rest of the "torun" array
                  migrations_run++;
                  run_migrations(torun);
                }
              });

            // if migration is JS code
            } else if (current.js) {

              // pass our db object and execute with callback to insert into schema migration AND recurse with rest of "torun" array
              current.js(db, function () {
                db.query("INSERT INTO schema_migrations VALUES ("+current.id+")", function (err, results) {
                  migrations_run++;
                  run_migrations(torun);
                });
              });
            }
          } else {

            // if no idea what to do, just skip!
            console.log("Unrecognized migration format, skipping.", current);
            run_migrations(torun);

          }

        // if no more migrations
        } else {
          // only output if we done work.
          if (migrations_run > 0)
            console.log("Migrations run: "+migrations_run);

          // if there is a callback, exec it
          if (cb) {
            cb();
          }
        }
      });




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

        //recursively run through all migrations after they have been sorted by ID in ascending order
        run_migrations(migrations.sort((function (a, b) { return ( parseInt(b.id) - parseInt(a.id)); })));
      });
    });
  }


  // run the migration with the final callback being a DB close.
  migrate(function () {
    db.end();
  });

// if provided a generate argument: ./script/migrate generate or ./script/migrate -g
} else if (process.argv[2] == "generate" || process.argv[2] == "-g") {
  // create new file name as the current timestamp
  filename = +(new Date());

  // if final argument was "js"
  if (process.argv[3] == "js") {
    // make a JS file and open it with the default EDITOR pre-populated with the rough boilerplate required.
    filename = migrations_dir+filename+".js";
    exec("echo 'module.exports.migrate = function(db, callback) {\n}' > "+filename+"; $EDITOR "+filename);
  } else {
    // make a SQL file and open it with the default EDITOR
    filename = migrations_dir+filename+".sql";
    exec("$EDITOR "+filename);
  }
}
