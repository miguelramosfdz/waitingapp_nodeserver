
// Node-gcm (Google Cloud Messaging)
var gcm = require('node-gcm');
var gcm_sender = new gcm.Sender('AIzaSyCseqXBYalWBoGdEwRrV4l6GtUqKmRs3gM');

var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var Q 		= require('q'),
	_ 		= require('underscore'),
	request = require('request'),
	fs 		= require('fs'),
	apn 	= require('apn');

var pushModel = {

	pushToUser: function(user, data, scheme_key, mod_conditions){
		// get user

		console.log('in_user', user);

		mod_conditions = mod_conditions || {};

		var def = Q.defer();

		var userDef = Q.defer();

		console.log('instanceOf');
		console.log(user instanceof ObjectId);

		if(user.toString().length == 24){
			// Need to get the user
			m.User.findOne({_id: user}, function(err, user){
				if(err){
					console.error(err);
					userDef.reject();
					return;
				}
				userDef.resolve(user);
			});
		} else {
			userDef.resolve(user);
		}

		console.log('user', user);

		userDef.promise.then(function(User){
			// Got the User
			// - get their Push Setting

			m.PushSetting.findOne({user_id: User._id}, function(err, PushSetting){
				if(err){
					console.error('Failed PushSetting in push_notification.js');
					console.error(err);
					return;
				}

				if(!PushSetting){
					console.log('No PushSetting');
				}

				// Default push value, from PushSettings for the user
				var sendPush;
				try {
					sendPush = PushSetting.scheme[scheme_key];
				}catch(err){
					console.error('No scheme_key for PushSetting:', scheme_key);
					console.error(err);
					sendPush = true; //PushSetting.scheme[scheme_key];
					// return;
				}

				if(sendPush === undefined){
					sendPush = true;
				}

				// Get any PushSetting "Mods" for this user/key combo
				// - also checks against the data passed in (event/game/spot id)

				var conditions = _.extend({}, mod_conditions);
				conditions.user_id = User._id;
				conditions.scheme_key = scheme_key;

				// switch(scheme_key){
				// 	case 'event':
				// 		conditions.event_id = ObjectId(data.id);
				// 	default:
				// 		break;
				// }

				m.PushSettingMod.findOne(conditions, function(err, PushSettingMod){
					if(err){
						console.error('PushSettingMod error');
						console.error(err);
						return;
					}

					// Determine what we'll do!
					if(PushSettingMod){
						// setting exists
						console.log('PushSettingMod exists');
						sendPush = PushSettingMod.scheme_value;
					}

					// Send Push (if enabled)
					if(sendPush !== true){
						console.log('Not setting Push according to PushSetting');
						return;
					} 


					// Android
					if(User.android && User.android.length > 0){
						pushModel.pushToAndroid(User.android[0].reg_id, data);
					} else {
						console.log("NO Android PUSH TO SEND FOR USER");
					}

					// iOS
					if(User.ios && User.ios.length > 0){
						console.log('Launching iOS push func');
						pushModel.pushToIOS(User.ios[0].reg_id, data);
					} else {
						console.log("NO iOS PUSH TO SEND FOR USER");
					}

				});


			});

		});

		return def.promise;
	},

	pushToIOS: function(registration_id, data){
		// http://devgirl.org/2012/10/19/tutorial-apple-push-notifications-with-phonegap-part-1/

		// The "payload" gets smushed into the whole "event" object received on iOS devices

		console.log('Sending a PUSH NOTIFICATION to IOS');

		// Create deferred
		var defer = Q.defer();

		try {
			var myDevice = new apn.Device(registration_id);
			var note = new apn.Notification();
			note.expiry = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // Expires 24 hours from now.
			note.badge = data.badge || 1;
			note.sound = "notification-beep.wav";
			// note.alert = {
			// 	"body" : data.body, 
			// 	"action-loc-key" : "Play" , 
			// 	"launch-image" : "mysplash.png"
			// };
			note.alert = data.ios_title; // title of the alert
			note.payload = {payload: JSON.stringify(data.payload)};
			 
			note.device = myDevice;
			 
			var errorCallback = function(errorNum, notification){
				console.log('Failed ios Push in callback');
			    console.log('Error is: %s', errorNum);
			    console.log("Note " + notification);
			}
			var options = {
			    gateway: 'gateway.sandbox.push.apple.com', // this URL is different for Apple's Production Servers and changes when you go to production
			    errorCallback: errorCallback,
			    cert: './certs/dev_cert.pem',                 
			    key:  './certs/dev_key.pem',                 
			    passphrase: 'uludev83',
			    port: 2195,                       
			    enhanced: true,                   
			    cacheLength: 100                  
			};

			var apnsConnection = new apn.Connection(options);
			apnsConnection.sendNotification(note);

			defer.resolve({
				err: null,
				result: {}
			});

		} catch(err){
			console.log('failed iOS Push in try...catch');
			console.log(err);
		}

		return defer.promise;

	},

	pushToAndroid: function(registration_id, data, collapseKey, timeToLive, numRetries){
		// Send a Push Message to a user

		// REQUIRES:
		// - title & message ONLY IF you want to display something in the notification bar
		// - no title+message results in no notification
		//		- can use title/messages-less notifications to trigger "instant" events (such as "hey, time to update!")

		console.log("Sending a PUSH NOTIFICATION to ANDROID");

		// Create deferred
		var defer = Q.defer();

		data = data || {};
		collapseKey = collapseKey || 'App Notifications';
		timeToLive = timeToLive || 180;
		numRetries = numRetries || 3;

		// Android Push
		// - everybody, for now
		var message = new gcm.Message();
		var registrationIds = [];

		// Every piece of data must be a string
		Object.keys(data).forEach(function(key) {
			if(typeof data[key] === typeof {}){
				message.addData(key, JSON.stringify(data[key]));
			} else {
				message.addData(key, data[key]);
			}
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
			console.log(result);

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
	}

};

exports.pushModel = pushModel;

