var orm = require(__dirname + "/../lib/orm");

orm.connect("pg://postgres:postgres@localhost/amber", function (success, db) {
  if (!success) {
    console.log("Error %d: %s", db.number, db.message);
    return;
  }
  var Person = db.define("person", {
       name: String,
    created: Date
  });
  Person.sync();

  Person.find({ name: [ "John Doe" ] }, function (people) {
    console.log(people);
  });
});
