
// Node-gcm (Google Cloud Messaging)
var gcm = require('node-gcm');
var gcm_sender = new gcm.Sender(config.get('gcm_sender_id')); // registered to founders@wehicleapp.com account

var _ = require('underscore');

// Promises
var Q = require('q');

console.log('Sendgrid credentials');

console.log(process.env.SENDGRID_USERNAME);
console.log(process.env.SENDGRID_PASSWORD);
var sendgrid  = require('sendgrid')(
	process.env.SENDGRID_USERNAME,
	process.env.SENDGRID_PASSWORD
);

exports.email = {
	send: function(sendObj){

		sendObj = _.extend({
			to: '',
			from: '',
			subject: '',
			text: ''
		},sendObj);

		// Send!
		sendgrid.send(sendObj, function(err, json) {
		if (err) { return console.error(err); }
			console.log(json);
		});
	}
};


exports.pushToAndroid = function(registration_id, data, collapseKey, timeToLive, numRetries){
	// Send a Push Message to a user

	// Create deferred
	var defer = Q.defer();

	data = data || {};
	collapseKey = collapseKey || 'Wehicle Notifications';
	timeToLive = timeToLive || 60;
	numRetries = numRetries || 3;

	// Android Push
	// - everybody, for now
	var message = new gcm.Message();
	var registrationIds = [];

	// Optional
	Object.keys(data).forEach(function(key) {
		message.addData(key, data[key]);
	});
	message.collapseKey = collapseKey;
	message.delayWhileIdle = false; // delay if not visible on the app? 
	message.timeToLive = timeToLive;

	// Add to registrationIds array
	// - at least one required
	registrationIds.push(registration_id);

	// Parameters: message-literal, registrationIds-array, No. of retries, callback-function

	// process.nextTick(function(){
	// 	var err = null,
	// 		result = "imposter";
	console.log("Registration ids");
	console.log(registrationIds);
	// gcm_sender.send(message, registrationIds, numRetries, function (err, result) {
	gcm_sender.sendNoRetry(message, registrationIds, function (err, result) {

		console.log('GCM result');
		if(err){
			console.log('GSM ERROR!!');
		}
		// console.log(result);

		/*
		Example result:
		{ multicast_id: 6673058968507728000,
		  success: 1,
		  failure: 0,
		  canonical_ids: 0,
		  results: [ { message_id: '0:1363393659420351%b678d5c0002efde3' } ] }
		 */

		// Result deferred
		defer.resolve({
			err: err,
			result: result
		});

	});

	// Return promise
	return defer.promise;

};

// exports.createNewUser = function(options){
	
// 	var defer = Q.defer();

//     // Create account (it will fail if the email already exists)
// 	var user_collection = models.mongo.collection('users');

// 	var email = options.email;
// 	var password = randomString(6).toString().toLowerCase();

// 	var userInsertObj = {
// 		email: email,
// 		password: password,
// 		password_default: options.password_default || true,
// 		role: options.role || 'driver',
// 		active: 1,
// 		created: new Date(),
// 		modified: new Date()
// 	};

// 	console.log('userInsertObj');
// 	console.log(userInsertObj);

// 	user_collection.insert(userInsertObj, function(err, newUser){
// 		if(err){
// 			console.log('Failed creating user');
// 			console.log(err.code);
// 			if(err.code == 11000){
// 				// Duplicate key error
// 				defer.resolve({
// 					complete: false,
// 					msg: 'duplicate'
// 				});
// 				return;
// 			}
// 			defer.resolve({
// 				complete: false,
// 				msg: 'unknown'
// 			});
// 			return;
// 		}

// 		console.log('User has signed up');
// 		console.log(newUser);
// 		console.log(email);

// 		// Create default driver for user
// 		var driver_collection = models.mongo.collection('drivers');
// 		var driverInsertObj = {
// 			user_id : newUser._id,
// 			connected_user_id : newUser._id,
// 			email: email,
// 			active : 1,
// 			is_me : 1,
// 			name : "Me"
// 		};
// 		driverInsertObj = matcher(driverInsertObj);

// 		console.log('Inserting driver too');
// 		console.log(driverInsertObj);

// 		// Insert
// 		driver_collection.insert(driverInsertObj, function(err, response){
// 			if(err){
// 				// Shit, completely failed to create the driver (somehow)
// 				// - should rollback everything!
// 				// - this shouldn't happen, so email us if it does (todo)

// 				console.log('ERROR: Driver NOT created for user');
// 				console.log(response);
// 				console.log(email);

// 				defer.resolve({
// 					complete: true,
// 					user_id: newUser._id,
// 					password: password,
// 					email: email
// 				});
// 				return;
// 			}
// 			console.log('Driver was created successfully too for the new User');
// 			console.log(response);
// 			defer.resolve({
// 				complete: true,
// 				user_id: newUser._id,
// 				password: password,
// 				email: email
// 			});
// 		});

// 		// Update drivers with my email
// 		// - add my new user_id to the connected_user_id
// 		driver_collection.update({ email: email }, {'$set' : { connected_user_id: newUser._id }}, function(err, results){
// 			if(err){
// 				console.log('ERROR: Failed updating other drivers, we should try again');
// 				return;
// 			}
// 			console.log('Done updating other drivers with my connected_user_id');
// 			console.log(results);

// 		});

// 	});


// 	return defer.promise;
// }

// Stripe (payments, credit cards, bank accounts, etc.)
var stripe2 = require('stripe'),
	stripe = new stripe2();
stripe.setApiKey((config.get('stripe_api_key'))); // test key
exports.stripe = stripe;
console.log('stripe created');


function matcher(objs){
	
	for(obj in objs){
		// console.log('obj');
		// console.log(obj); // key?
		var pattern = new RegExp("^[0-9a-fA-F]{24}$");

		if(typeof objs[obj] == 'string' && pattern.test(objs[obj])){
			objs[obj] = ObjectID(objs[obj]); //mongojs.ObjectId(string);

			continue;
		}

	}

	return objs;
}

function randomString(length) {
	var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
	length = length ? length : 32;

	var string = '';

	for (var i = 0; i < length; i++) {
		var randomNumber = Math.floor(Math.random() * chars.length);
		string += chars.substring(randomNumber, randomNumber + 1);
	}

	return string;
}