
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId,
	serializer = require('serializer'),
	request = require('request'),
	async = require('async'),
	crypto = require('crypto'),
	default_serializer = serializer.createSecureSerializer(config.get('serialize_key'), config.get('serialize_secret')); // encryption key, signing key

module.exports = function(app) {
  

	app.post('/invite/user/email', function(req, res) {
		console.log('Sending an email invite to a user');

		// can send an unlimited amount to an email address (from multiple people, or from the same person)

		checkUserAuth(req, res)
			.then(function(user){
				// Send an invite email to the person

				console.log(1);

				var email = req.body.email.trim().toLowerCase();

				console.log(email);

				// See if an invite to this email already exists
				// - from this user
				m.Invite.findOne({email: email, user_id: user._id})
				.exec(function(err, foundInvite){
					if(err){
						console.error(err);
						return;
					}

					if(foundInvite){
						console.log('Invite already exists');
						return;
					}

					if(user.email == email){
						console.log('Trying to invite myself');
						return;
					}

					console.log('No existing invite');

					// No existing invite, create one
					// - could upsert, right?
					var Invite = new m.Invite({
						user_id: user._id,
						email: email,
						active: true
					});

					// Add an entry to Invite model
					Invite.save(function(err, newInvite){
						if(err){
							console.error(err);
							return;
						}

						console.log('Saved invite');

					});

					// Does this email belong to a current user?
					// - create the Friend relationship automatically
					m.User.findOne({email: email, _id: {'$ne' : user._id}})
					.exec(function(err, otherUser){
						if(err){
							console.error(err);
							return;
						}

						if(!otherUser){
							console.log('No existing user that we will auto-friend');
							return;
						}

						// Myself?
						if(otherUser._id.toString() == user._id.toString()){
							errorhandler(err, res, 415, 'Cannot add yourself');
							return;
						}

						// already friends?
						m.Friend.findOne({
							user_id: user._id,
							friend_id: otherUser._id
						}, function(err, AlreadyFriends){
							if(err){
								errorhandler(err, res);
								return;
							}

							if(AlreadyFriends){
								// Update friend results

								console.log('Already friends');

								// res.json({
								// 	code: 200,
								// 	_id: otherUser._id,
								// 	type: 'friend'
								// });
								return;

							}

							// Not already friends

							// Create the result!
							var meFriend = new m.Friend({
								user_id: user._id,
								friend_id: otherUser._id,
								type: 'friend',
								active: true
							});
							meFriend.save(function(err, newFriend){
								if(err){
									console.error(err);
									return;
								}
								console.log('saved meFriend');
							});
							var themFriend = new m.Friend({
								user_id: otherUser._id,
								friend_id: user._id,
								type: 'friend',
								active: true
							});
							themFriend.save(function(err, newFriend){
								if(err){
									console.error(err);
									return;
								}
								console.log('saved themFriend');
							});

							// Notify the other person!
							m.PushNotification.pushToUser(otherUser, {
								ios_title: 'New Connection: ' + user.profile.name,
								title: 'New Connection',
								message: user.profile.name,
								payload: {type: 'new_connection', id: user._id, name: user.profile.name}
							}, 'new_connection', {});

							// Notify Me!
							m.PushNotification.pushToUser(user, {
								ios_title: 'New Connection: ' + otherUser.profile.name,
								title: 'New Connection',
								message: otherUser.profile.name,
								payload: {type: 'new_connection', id: otherUser._id, name: otherUser.profile.name}
							}, 'new_connection', {});
							
							console.log('Connected two friends!');

							// Aight, saved probably!
							console.log('Saved new Friend relationship');
							// res.json({
							// 	code: 200,
							// 	_id: otherUser._id,
							// 	type: 'friend'
							// });

						
						});

					});

				});

				// Does this email already belong to somebody?
				
				console.log('SENDING EMAIL');


				// Get the user's Media
				var mediaConditions = {
					user_id: user._id,
					active: true
				};
				m.Media.find(mediaConditions)
				.exec(function(err, media){
					if(err){
						console.log('Failed getting media for the sending user!');
						media = [];
					}

					// Send email
					models.email.send({
						to: email,
						from: user.email,

						swu_template: config.get('swu_tpl_invite'), // View my media!
						data: {
							config: config.get(), // all variables!
							user: user.toJSON(),
							media: media
						}

					});

				});

				res.json(true);

			});
	});


}