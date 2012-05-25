var
  util = require("util"),
  orm = require("../lib/orm"),
  step = require('step'),
  assert = require('assert'),
  should = require('should'),
  uuid = require('node-uuid');

describe('Basic model', function() {

  var
    db = null,
    client = null,
    Test = null,
    Thing = null,
    string_value = "value",
    string_value2 = "value 2",
    date_value = new Date(),
    text_value = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam sit amet augue quis augue vehicula vulputate. Nam nec erat et mauris consectetur ultrices. Maecenas varius ante enim. Aliquam erat volutpat. Integer enim ligula, facilisis et bibendum id, rutrum vel orci. Nam pharetra convallis venenatis. Sed facilisis massa a tortor pellentesque semper. In hac habitasse platea dictumst. Duis quis facilisis nisl. Nulla luctus turpis eget sem tempus lobortis. Phasellus at lorem metus, eget ullamcorper libero. Maecenas viverra arcu quis eros imperdiet condimentum. Maecenas in massa ipsum, vel eleifend est. Aliquam erat volutpat. Donec ac velit sed turpis tincidunt posuere.",
    integer_value = 12345678,
    float_value = 123.45,
    boolean_value = true,
    object_value = {"a": 1, "b": 2},
    uuid_value = "84351555-8704-4e86-9a1c-2b69e18a5b61",
    binary = new Buffer([0x66, 0x6f, 0x6f, 0x00, 0x80, 0x5c, 0xff]);
    
  before(function(done) {
    orm.connect("postgres://orm:orm@localhost/orm", function(success, new_db) {
      success.should.be.ok;
      db = new_db;
      client = db.getClient();
      db.setLogQueries(true);
      done();
    });
  });
  
  beforeEach(function(done) {
    step(
      function drop_relations() {
        client.query("drop table if exists test", this.parallel());
        client.query("drop table if exists thing", this.parallel());
        client.query("drop sequence if exists test_id_seq", this.parallel());
        },
      function create_test_object(err, drop1, drop2) {
        if (err) {
          throw err;
        }
        
        Test = db.define("test", {
          _params: ["no-id"],  // TODO: make it a separate model?
          f_string: "string",
          f_date: "date",
          f_text: "text",
          f_integer: "integer",
          f_float: "float",
          f_boolean: "boolean",
          f_data: "data",
          // "f_enum": {"type": "enum", "values": [ "dog", "cat", "fish" ]},
          f_object: "object",
          f_uuid: "uuid",
          f_auto_uuid: {type: "uuid" /*, primary: true*/},
          
          f_string_null: {type: "string", "null": true},
          f_date_null: {type: "date", "null": true},
          f_text_null: {type: "text", "null": true},
          f_integer_null: {type: "integer", "null": true},
          f_float_null: {type: "float", "null": true},
          f_boolean_null: {type: "boolean", "null": true},
          f_data_null: {type: "data", "null": true},
          // f_enum: {type: "enum", "values": [ "dog", "cat", "fish" ]},
          f_object_null: {type: "object", "null": true},
          f_uuid_null: {type: "uuid", "null": true}
          }, {
            idProperty: "f_auto_uuid",
            methods : {
              f_calculated: function () {
                return this.f_string + " " + this.f_integer;
              }
            },
            hooks: {
              beforeSave: function (test) {
                if (!test.f_auto_uuid) {
                  test.f_auto_uuid = uuid.v4();
                }
              }
            }
          });
        
        Thing = db.define("thing", {
          _params: ["no-id"],  // TODO: make it a separate model?
          f_string: "string",
          f_auto_uuid: "uuid"
          }, {
            idProperty: "f_auto_uuid",
            hooks: {
              beforeSave: function (test) {
                if (!test.f_auto_uuid) {
                  test.f_auto_uuid = uuid.v4();
                }
              }
            }
          });
        Thing.hasOne("f_test", Test);
        Test.sync();
        Thing.sync();
        
        return 1;
      },
      function(err, value) {
        if (err) {
          throw err;
        }
        done();
      }
    );
  });

  it('should provide access to meta data', function(done) {
    should.exist(Test._getMeta());
    Test._getName().should.equal("test");
    done();
  });
  
  describe('queries', function() {
    it('should create', function(done) {      
      var test = new Test({
        f_string: string_value,
        f_date: date_value,
        f_text: text_value,
        f_integer: integer_value,
        f_float: float_value,
        f_boolean: boolean_value,
        f_data: binary,
        // f_enum: {type: "enum", values: [ "dog", "cat", "fish" ]},  // not supported by pg
        f_object: object_value,
        f_uuid: uuid_value
      });
      should.exist(test._getModel());
      should.exist(test._getModel()._getMeta);
      (typeof test._getModel()._getMeta).should.be.equal("function");
      test.save(function(err, copy) {
        if (err) {
          console.log("saved 1", err);
          return done(err);
        }
        
        should.exist(test.f_auto_uuid);
        
        Test.find({ f_string: [ "value" ] }, function (results) {
          // console.log("results:", util.inspect(results));
          should.exist(results);
          results.length.should.equal(1);
          results[0].f_string.should.equal(string_value);
          // TODO results[0].f_date.should.equal(date_value);
          results[0].f_text.should.equal(text_value);
          results[0].f_integer.should.equal(integer_value);
          results[0].f_float.should.equal(float_value);
          results[0].f_boolean.should.equal(boolean_value);
          assert.deepEqual(results[0].f_data, binary);
          assert.deepEqual(results[0].f_object, object_value);
          
          
          should.not.exist(results[0].f_string_null);
          should.not.exist(results[0].f_date_null);
          should.not.exist(results[0].f_text_null);
          should.not.exist(results[0].f_integer_null);
          should.not.exist(results[0].f_float_null);
          // should.not.exist(results[0].f_boolean_null); // TODO: boolean field should be nullable...
          should.not.exist(results[0].f_data_null);
          should.not.exist(results[0].f_object_null);
          
          results[0].f_calculated().should.equal(string_value + " " + integer_value);  // TODO: not so good for caclulated fields.
          
          // TODO: this save should not change anything...
          test.save(function(err, copy) {
            if (err) {
              console.log("save again", err);
              return done(err);
            }
            done();
          });
          
        });
      });

    });
    it('should find by uuid with get', function(done) {            
      var test = new Test({
        f_string: string_value,
        f_date: date_value,
        f_text: text_value,
        f_integer: integer_value,
        f_float: float_value,
        f_boolean: boolean_value,
        f_object: object_value,
        f_data: binary,
        f_uuid: uuid_value
      });
      test.save(function(err, copy) {
        if (err) {
          console.log("saved 2", err);
          return done(err);
        }
        
        Test.get(test.f_auto_uuid, function (result) {
          console.log("result 1", util.inspect(result));
          should.exist(result);
          
          result.f_string = string_value2;
          result.save(function(err, copy) {
            if (err) {
              console.log("save again", err);
              return done(err);
            }
            Test.get(test.f_auto_uuid, function (result) {
              // console.log("result 2", util.inspect(result));
              should.exist(result);
              done();
            });
          });
          
        });
      });

    });

    it('should delete record', function(done) {      
      
      var test = new Test({
        f_string: string_value,
        f_date: date_value,
        f_text: text_value,
        f_integer: integer_value,
        f_float: float_value,
        f_boolean: boolean_value,
        f_object: object_value,
        f_data: binary,
        f_uuid: uuid_value
      });
      test.save(function(err, copy) {
        if (err) {
          console.log("saved 3", err);
          return done(err);
        }
        
        Test.get(test.f_auto_uuid, function (result) {
          should.exist(result);
          
          result.remove(function(err) {
            if (err) {
              console.log("remove", err);
              return done(err);
            }
            Test.get(test.f_auto_uuid, function (result) {
              should.not.exist(result);
              done();
            });
          });
          
        });
      });

    });


  });
  describe('Relationships', function() {
  });
});


// TODO: test hasone
// TODO: test has many
// TODO: hooks should support list of functions (like validations)
// TODO: before functions: created_on, updated_on, uuid_gen
// TODO: implement arrays
// TODO: same db object => same js object, does it make sense?
// TODO: implement soft delete