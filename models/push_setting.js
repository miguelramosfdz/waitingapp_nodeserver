// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var Q = require('q');

var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' },

  scheme: {

    new_friend: { type: Boolean, default: true },
    new_message: { type: Boolean, default: true },

  },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

var pushSettingModel = mongoose.model('push_settings', schema);

exports.pushSettingModel = pushSettingModel;