// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var schema = Schema({
	
	user_id: { type: ObjectId },
	type: { type: String },
	name: { type: String },
	last4: { type: String },
	cardid: { type: String },
	token: { type: String },
	active: { type: Boolean },

	created: { type: Date, default: Date.now }

});

var Model = mongoose.model('payment_sources', schema);

exports.Model = Model;