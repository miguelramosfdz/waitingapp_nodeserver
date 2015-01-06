// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var schema = Schema({

  user_id:{ type: ObjectId, ref: 'users' },
  code: { type: String },
  type: { type: String }, // add_friend, etc.

  active: { type: Boolean },
  redeemed: { type: Boolean },

  created: { type: Date },
  modified: { type: Date }
});

var relationshipModel = mongoose.model('relationship_codes', schema);

exports.Model = relationshipModel;