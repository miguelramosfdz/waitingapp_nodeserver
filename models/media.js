
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;


var schema = Schema({

  user_id: { type: ObjectId, ref: 'users' },

  assembled: { type: Boolean },
  assembly_id: { type: String },
  assembly_results: { type: Object },

  urls: { type: Object }, // parsed out { 'type_of_transform' : 's3path'}

  active: { type: Boolean, default: true },
  
  type: { type: String },
  filename: { type: String },
  extra: { type: Object },

  created: { type: Date, default: Date.now },
  modified: { type: Date, default: Date.now }

});

exports.Model = mongoose.model('media', schema);
