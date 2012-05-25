var util = require("util"),
    events = require("events");

function DBQuery(query) {
  events.EventEmitter.call(this);

  query.on("row", (function (o) {
    return function (row) {
      o.emit("record", row);
    };
  })(this));
  query.on("end", (function (o) {
    return function (res) {
      o.emit("end", res);
    };
  })(this));
  query.on("error", (function (o) {
    return function (err) {
      o.emit("error", err);
    };
  })(this));
}
util.inherits(DBQuery, events.EventEmitter);

function DBClient(client) {
  this._client = client;
  this._logQueries = false;
}

DBClient.prototype.getClient = function () {
  return this._client;
}

DBClient.prototype.setLogQueries = function(log) {
  this._logQueries = log;
}

// TODO: psq: add config param (for callback, more?)
DBClient.prototype.createCollection = function (collection, fields, assocs, callback) {
  var _table = collection.toLowerCase();
  var _query = "CREATE TABLE \"%table\" (%values)", _fields = [], _indexes = [];
  _query = _query.replace("%table", _table);

  var field_names = [], self = this;
  var add_id = (!fields._params || fields._params.indexOf("no-id") == -1);
  var unique_record = (fields._params && fields._params.indexOf("unique-record") != -1);
  var text_search_fields = [];

  if (add_id) {
    _fields.push("\"id\" SERIAL");
  }
  for (var k in fields) {
    if (k == "_params") {
      continue;
    }

    var field = "\"" + k + "\"";

    if (fields[k].textsearch) {
      text_search_fields.push(k);
    }

    switch (fields[k].type) {
      case "enum":
        throw new Error("enum type not supported");
        field += " ENUM ('" + fields[k].values.join("', '") + "')";
        break;
      case "struct":
      case "object":
      case "text":  field += " TEXT"; break;
      case "num":
      case "number":
      case "int":
      case "integer": field += " INTEGER"; break;
      case "float": field += " REAL"; break;
      case "bool":
      case "boolean": field += " BOOLEAN"; break;
      case "date":  field += " TIMESTAMP"; break;
      case "data":  field += " BYTEA"; break;
      case "uuid":  field += " UUID"; break;
      default:
        field += " VARCHAR(255)";
    }

    field_names.push(k);
    if (fields[k].hasOwnProperty("default")) {
      if (fields[k].hasOwnProperty("type") && fields[k]["type"] == "uuid") {
        _fields.push(field + " NOT NULL");  // value will be generated on create
      } else {
        _fields.push(field + " DEFAULT '" + fields[k]["default"] + "'");
      }
    } else if (fields[k].hasOwnProperty("null")) {
      if (!fields[k]["null"]) {
        _fields.push(field + " NOT NULL");
      } else {
        _fields.push(field);
      }
    } else {
      _fields.push(field + " NOT NULL");
    }
  }

  for (var i = 0; i < assocs.length; i++) {
    switch (assocs[i].type) {
      case "one":
        console.log("source:", util.inspect(assocs[i].source_model));
        console.log("target:", util.inspect(assocs[i].target_model));
        
        console.log("relate hasOne", "source:", assocs[i].source_model._getName(), "target:", assocs[i].target_model._getName());
        console.log("target.meta=", assocs[i].target_model._getMeta());
        var targetMeta = assocs[i].target_model._getMeta();
        console.log("target id", targetMeta.colParams.idProperty, ":", targetMeta.fields[targetMeta.colParams.idProperty].type);
        var field = assocs[i].field + "_id";
        _fields.push("\"" + field + "\" " + targetMeta.fields[targetMeta.colParams.idProperty].type + " NOT NULL");  // TODO: get target type
        _indexes.push(field);
        field_names.push(field);
        break;
      case "many":
        this.createCollection(_table + "_" + assocs[i].field, {
          "_params": [ "unique-record", "no-id" ]
        }, [{
          "field" : _table,
          "type"  : "one",
          "entity": this
        }, {
          "field" : assocs[i].name || assocs[i].field,
          "type"  : "one",
          "entity": assocs[i].entity
        }]);
        break;
    }
  }

  if (add_id) {
    _fields.push("PRIMARY KEY (\"id\")");
  }

  if (unique_record) {
    _fields.push("PRIMARY KEY (\"" + field_names.join("\", \"") + "\")");
  }

  var context = this;
  _query = _query.replace("%values", _fields.join(", "));
  if (this._logQueries) {
    console.log("\n" + _query);
  }
  this._client.query(_query, function (err, info) {
    if (err) {
      return callback(err);
    }
    if (text_search_fields.length > 0) {
      _query = "CREATE INDEX \"" + _table + "_idx\" " + "ON \""+_table+"\" " +
                "USING gin(to_tsvector('english', " + text_search_fields.join(" || ' ' || ") + "))";
      if (context._logQueries) {
        console.log("\ntext_search_field: " + _query);
      }
      self._client.query(_query, function () {});
    }
    if (!unique_record) {
      for (i = 0; i < _indexes.length; i++) {
        _query = "CREATE INDEX \"" + _table + "_" + _indexes[i] + "_idx\" " + "ON \"" + _table + "\"(" + _indexes[i] + ")";
        if (context._logQueries) {
          console.log("\nunique record: " + _query);
        }
        self._client.query(_query, function() {});
      }
    }
    // #TODO: need to also gather errors from the create index...
    return callback(null);
  });
};

DBClient.prototype.selectRecords = function (collection, config) {
  var _table = collection.toLowerCase(collection),
      _query = "SELECT * FROM \"" + _table + "\"",
      _escapes = [], tmp;

  config = config || {};

  if (config.conditions) {
    tmp = this._addQueryConditions(_query, config.conditions);
    _query = tmp[0];
    _escapes = tmp[1];
  }
  if (config.order) {
    _query = this._addQueryOrder(_query, config.order);
  }
  if (config.limit) {
    _query = this._addQueryLimit(_query, config.limit, config.skip);
  }

  if (this._logQueries) {
    console.log("\nselectRecords: " + _query, _escapes);
  }
  if (typeof config.callback == "function") {
    this._client.query(_query, _escapes, function (err, info) {
      if (err) {
        config.callback(err);
        return;
      }

      config.callback(null, info.rows);
    });
  } else {
    return new DBQuery(this._client.query(_query, _escapes));
  }
};

DBClient.prototype.searchRecords = function (collection, config) {
  var _table = collection.toLowerCase(collection);
  var _query = "SELECT * FROM \"" + _table + "\" WHERE to_tsvector(body) @@ to_tsquery('%text')";

  config.text = config.text.replace(/\Wand\W/gi, " & ");
  config.text = config.text.replace(/\Wor\W/gi, " | ");
  config.text = config.text.replace(/\Wnot\W/gi, " !");
  _query = _query.replace("%text", config.text.replace("'", "''"));

  if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

  if (this._logQueries) {
    console.log("\nsearchRecords: " + _query);
  }
  this._client.query(_query, function (err, info) {
    if (err) {
      config.callback(err);
      return;
    }

    config.callback(null, info.rows);
  });
};

DBClient.prototype.clearRecords = function (collection, config, callback) {
  var _table = collection.toLowerCase(collection),
      _query = "DELETE FROM \"" + _table + "\"",
      _escapes = [],
      tmp;

  config = config || {};

  if (config.conditions) {
    tmp = this._addQueryConditions(_query, config.conditions);
    _query = tmp[0];
    _escapes = tmp[1];
  }
  if (config.order) _query = this._addQueryOrder(_query, config.order);
  if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

  if (this._logQueries) {
    console.log("\n" + _query, _escapes);
  }
  this._client.query(_query, _escapes, function (err, info) {
    if (err) {
      config.callback(err);
      return;
    }

    config.callback(null, info.rows);
  });
};

DBClient.prototype.saveRecord = function (idProp, collection, data, meta, newRecord, callback) {
  // if ((idProp && data[idProp] && parseInt(data[idProp]) > 0) || (!newRecord)) {
  if (!newRecord) {
    var id = null;
    if (idProp) {
      var id = data[idProp];
      delete data[idProp];
    }
    this._updateRecord(collection, idProp, data, id, meta, callback);
  } else {
    this._insertRecord(collection, idProp, data, meta, callback);
  }
};

DBClient.prototype._insertRecord = function (collection, idProp, data, meta, callback) {
  var _table = collection.toLowerCase(),
   self = this,
   _query = "INSERT INTO \"" + _table + "\" (%fields) VALUES (%values)",
   _fields = [],
   _values = [],
   _escapes = [],
   n = 1;

  for (var k in data) {
    if (!data.hasOwnProperty(k)) continue;

    _fields.push("\"" + k + "\"");
    _values.push("$" + (n++));

    // console.log("typeof data[k]:", data[k], typeof data[k]);
    switch (typeof data[k]) {
      case "undefined":
        _values.pop();
        _fields.pop();
        n--;
        break;
      default:
        _escapes.push(data[k]);
    }
  }

  _query = _query.replace("%fields", _fields.join(", "));
  _query = _query.replace("%values", _values.join(", "));

  if (this._logQueries) {
    console.log("\n" + _query, _escapes);
  }
  var context = this;
  this._client.query(_query, _escapes, function (err, info) {
    if (err) {
      // console.log("insert record:", err);
      callback(err);
      return;
    }
    // console.log("meta:", meta);
    if (idProp && meta.fields[idProp].type === 'integer') {
      _query = "SELECT CURRVAL(pg_get_serial_sequence('" + _table + "', '" + idProp + "'))";
      if (context._logQueries) {
        console.log("\n" + _query, "\n");
      }
      self._client.query(_query, function (err, info) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, info.rows[0].currval);
      });
    } else if (idProp) {
      callback(null, data[idProp]);
    } else {
      callback(null, "no-id");
    }
  });
};

DBClient.prototype._updateRecord = function (collection, idProp, data, id, meta, callback) {
  var _table = collection.toLowerCase(),
    _query = "UPDATE \"" + _table + "\" SET %values WHERE \"" + idProp + "\"=\'" + id + "\'",
    _values = [],
    _escapes = [],
    n = 1;

  for (var k in data) {
    if (!data.hasOwnProperty(k)) continue;

    _values.push("\"" + k + "\"=$" + (n++));

    switch (typeof data[k]) {
      case "undefined":
        _values.pop();
        n--;
        break;
      default:
        _escapes.push(data[k]);
    }
  }

  _query = _query.replace("%values", _values.join(", "));
  if (this._logQueries) {
    console.log("\n" + _query, _escapes);
  }
  this._client.query(_query, _escapes, function (err, info) {
    if (err) {
      callback(err);
      return;
    }

    callback(null);
  });
};

DBClient.prototype._addQueryConditions = function (query, conditions, escapes) {
  var _conditions = [], prop, op,
      _escapes = (escapes || []), n = _escapes.length + 1;

  for (var k in conditions) {
    if (!conditions.hasOwnProperty(k)) continue;

    if (k.indexOf(" ") > 0) {
      op = k.substr(k.indexOf(" ") + 1, k.length).replace(/^\s+/, "");
      prop = k.substr(0, k.indexOf(" "));

      if ([ "=", "!", ">", "<", ">=", "<=" ].indexOf(op) == -1) {
        op = "=";
      } else if (op == "!") {
        op = "!=";
      }
    } else {
      prop = k;
      op = "=";
    }

    switch (typeof conditions[k]) {
      case "boolean":
      case "number":
        _conditions.push("\"" + prop + "\"" + op + conditions[k]);
        break;
      default:
        if (Array.isArray(conditions[k])) {
          var array_conditions = [];

          for (var i = 0; i < conditions[k].length; i++) {
            array_conditions.push("$" + (n++));
            _escapes.push(conditions[k][i]);
          }
          _conditions.push("\"" + prop + "\"" + (op == "!=" ? " NOT" : "") + " IN (" + array_conditions.join(", ") + ")");
        } else if (typeof conditions[k] == "object" && conditions[k].hasOwnProperty("__ormFunction")) {
          _conditions.push(conditions[k].__ormFunction.replace(/\#\#/g, "\"" + prop + "\"") + op + "$" + (n++));
          _values.push(conditions[k].v);
        } else {
          _conditions.push("\"" + prop + "\"" + op + "$" + (n++));
          _escapes.push(conditions[k]);
        }
    }
  }

  return [ query + " WHERE " + _conditions.join(" AND "), _escapes ];
};

DBClient.prototype._addQueryOrder = function (query, order) {
  if (!order.match(/\s(asc|desc)$/i)) {
    order += " asc";
  }

  return query + " ORDER BY " + order.replace(/\w+/g, function (word) {
    if ([ "ASC", "DESC" ].indexOf(word.toUpperCase()) != -1)
      return word.toUpperCase();
    return "\"" + word + "\"";
  });
};

DBClient.prototype._addQueryLimit = function (query, limit, skip) {
  if (skip) {
    return query + " LIMIT " + skip + ", " + limit;
  }
  return query + " LIMIT " + limit;
};

DBClient.prototype.end = function () {
    this._client.end();
};

exports.connect = function (options, callback) {
  var pg = require("pg");
  var opts = {
    "host"    : "localhost",
    "port"    : 5432,
    "user"    : "postgres",
    "password"  : "",
    "database"  : "postgres"
  };

  if (options.auth) {
    var p;
    if ((p = options.auth.indexOf(":")) != -1) {
      options.user = options.auth.substr(0, p);
      options.password = options.auth.substr(p + 1);
    } else {
      options.user = options.auth;
    }
  }
  if (options.pathname) {
    options.database = options.pathname.substr(1);
  }
  if (options.hostname) {
    options.host = options.hostname;
  }

  for (var k in options) {
    if (opts.hasOwnProperty(k)) {
      opts[k] = options[k];
    }
  }

    var client = new pg.Client("pg://"+opts.user+":"+opts.password+"@"+opts.host+":"+opts.port+"/"+opts.database);
    var errorListener = function(err) {
      callback(false, { "number": parseInt(err.code), "message": err.message });
    };
    client.once("error", errorListener);
    client.once("connect", function() {
        client.removeListener("error", errorListener);
        callback(true, new DBClient(client));
    });
    client.connect();
};

exports.use_db = function (rawDb, callback) {
  callback(true, new DBClient(rawDb));
};
