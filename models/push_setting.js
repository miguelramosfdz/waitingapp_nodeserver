// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var Q = require('q');

var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' },

  scheme: {

    testpush: { type: Boolean, default: true },

    new_connection: { type: Boolean, default: true },
    new_message: { type: Boolean, default: true },


  },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

exports.Model = mongoose.model('push_settings', schema);