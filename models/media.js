
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;


var schema = Schema({

  player_id: { type: ObjectId, red: 'players' },
  user_id: { type: ObjectId, ref: 'users' },
  game_id: { type: ObjectId, ref: 'games' },

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

exports.mediaModel = mongoose.model('media', schema);
