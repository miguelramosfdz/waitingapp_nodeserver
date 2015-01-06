
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;


var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' },
  friend_id: { type: ObjectId, ref: 'users' },

  type: String, // friend, potential

  name: String, // optional, used by email-only friends
  email: String, // optional, used by email-only friends

  recommend: { type: Boolean, default: false },

  active: { type: Boolean, default: true },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

exports.Model = mongoose.model('user_friends', schema);
