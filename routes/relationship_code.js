
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {
  
	app.get('/relationships/add_friend', function(req, res) {
		console.log("Creating a RelationshipCode for a new connection");

		checkUserAuth(req, res)
			.then(function(user){

				// Return the single RelationshipCode for this player to use
				// - creates one if one does not already exist

				// Create it (does not exist yet)
				var rString = randomString(7).toUpperCase();
				var RCode = new m.RelationshipCode({
					
					user_id: user._id,

					code: rString, // 7 characters is a decent namespace?

					type: 'add_friend',

					active: true,
					redeemed: false,

					created: new Date()
				});

				RCode.save(function(err, newRCode){
					if(err){
						console.log('Failed saving new RCode');
						res.status(500);
						res.json(false);
						return;
					}

					// Return to client
					res.json(newRCode);

				});


			});
		

	});

	app.post('/relationships/invited', function(req, res) {
		console.log("Attempting to accept a relationship code");

		checkUserAuth(req, res)
			.then(function(user){

				// See if this is a valid, unredeemed code
				
				m.RelationshipCode.findOne({code: req.body.code.toUpperCase()})
				.populate('user_id')
				.exec(function(err, RCode){
					if(err){
						console.log('Failed finding code');
						res.status(500);
						res.json(false);
						return;
					}

					if(!RCode){
						// Unable to find that one
						res.status(401);
						res.json(false);
						return;
					}

					if(RCode.user_id._id == user._id){
						res.status(401);
						res.json("Cannot accept your own invite");
						return;
					}

					// Got a code

					// Valid, or redeemed?
					if(!RCode.active || RCode.redeemed){

						// If it was redeemed, and is for a device...
						// - add to PotentialPlayer queue for Owner? 
						// - swapping owners of the device? Have a different transfer mechanism
						// - todo: explore further

						res.json({
							code: 401,
							msg: 'Not an active invite'
						});
						return;
					}

					// All good!

					var group_key = guid();

					// Create the relationship between this User and the Player
					// - one person may have created a Player, the person may not have
					//   - the incoming will include a code for the other person, and whether I am 
					//   - otherwise, they are scanning from the "create player" screen (and auto-creating a user for themselves)
					switch(RCode.type){
						case 'add_friend':
							// We scanned a code on somebody else's phone
							// - see if we are already friends!

							// ... fuck it, don't even need to check, just push it onto the array

							// Update me
							user.update({
								'$addToSet' : {
									'friends' : RCode.user_id._id
								}
							},
							{},
							 function(err, result){
								if(err){
									console.error('Failed saving that friend 3497111');
									console.error(err);
									return;
								}
								console.log('Updated my friend list OK');
							});

							// Update _them_
							RCode.user_id.update({
								'$addToSet' : {
									'friends' : user._id
								}
							},
							{},
							 function(err, result){
								if(err){
									console.error('Failed saving that friend 32498');
									console.error(err);
									return;
								}
								console.log('Updated their friend list OK');
							});

							// Notify the other person!
							m.PushNotification.pushToUser(RCode.user_id, {
								ios_title: 'New Friend: ' + user.profile.name,
								title: 'New Friend',
								message: user.profile.name,
								payload: {type: 'new_friend', id: user._id, name: user.profile.name}
							}, 'new_friend', {});
							
							console.log('Connected two friends!');

							// Aight, saved probably!
							res.json({
								code: 200,
								_id: RCode.user_id._id,
								type: 'friend'
							});

							return;

							break;

						default:
							console.log('Failed RCode type');
							res.status(500);
							res.json(false);
							break;
					}

				});

			});
		

	});

}