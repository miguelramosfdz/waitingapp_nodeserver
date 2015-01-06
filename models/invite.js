// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var Q = require('q');

var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' }, // user it was sent FROM
  email: { type: String, lowercase: true }, // user's email it was sent TO

  active: { type: Boolean, default: true },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

var Model = mongoose.model('invites', schema);

exports.Model = Model;