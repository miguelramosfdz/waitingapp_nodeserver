// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var schema = Schema({

	user_id: { type: ObjectId, ref: 'users' },

	from_user_id: { type: ObjectId, ref: 'users' },
	to_user_id: { type: ObjectId, ref: 'users' },

	stripe_id: String,
	data: Object,

	created: { type: Date, default: Date.now },
	modified: { type: Date, default: Date.now }

});

var Model = mongoose.model('payment_charges', schema);

exports.Model = Model;