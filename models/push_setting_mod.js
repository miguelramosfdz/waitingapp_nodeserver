// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var Q = require('q');

var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' },

  scheme_key: String,
  scheme_value: Boolean, // true|false

  // // Optional, one may match
  // event_id: ObjectId,
  // game_id: ObjectId,
  // spot_id: ObjectId,

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

var pushSettingModModel = mongoose.model('push_setting_mods', schema);

exports.pushSettingModModel = pushSettingModModel;