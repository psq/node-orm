// var util = require("util");
// var orm = require("../lib/orm");
// var step = require('step');
// 
// describe('DB Options', function() {
// 
//   var
//     db = null,
//     client = null;
//     
//   before(function(done) {
//     orm.connect("postgres://orm:orm@localhost/orm", function(success, new_db) {
//       success.should.be.ok;
//       db = new_db;
//       client = db.getClient();
//       done();
//     });
//   });
//   
//   beforeEach(function(done) {
//     step(
//       function drop_relations() {
//         client.query("drop table if exists test", this.parallel());
//         client.query("drop sequence if exists test_id_seq", this.parallel());
//         },
//       function() {
//         done();
//       }
//     );
//   });
// 
//   describe('#indexOf()', function() {
//     it('should return -1 when the value is not present', function() {
// 
//       var Test = db.define("test", {
//         "su_uuid": "string",
//         "su_name": "string",
//         "su_identifier": "string",
//         "su_active": "boolean",
//         "su_created_on": "date",
//         "su_updated_on": "date",
//         "su_summary": "string",
//         "su_private": "boolean"    
//       });
// 
// 
//     });
//     it('should return -1 when the value is not present', function() {
//       [1,2,3].indexOf(5).should.equal(-1);
//       [1,2,3].indexOf(0).should.equal(-1);
//     });
//   });
//   describe('#indexOf()', function() {
//     it('should return -1 when the value is not present', function() {
//       [1,2,3].indexOf(5).should.equal(-1);
//       [1,2,3].indexOf(0).should.equal(-1);
//     });
//   });
// });
