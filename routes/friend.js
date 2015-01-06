
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {

	app.get('/friend/:friend_id', function(req, res) {
		console.log("Relationship for a friend and I");

		checkUserAuth(req, res)
			.then(function(user){

				var friend_id = ObjectID(req.params.friend_id);

				var conditions = {
					user_id: user._id,
					friend_id: friend_id,
					type: 'friend',
					active: true
				}

				m.Friend.findOne(conditions)
				// .populate()
				.exec(function(err, Friend){
					if(err){
						errorhandler(err, res);
						return;
					}

					if(!Friend){
						errorhandler('no friend relationship', res, 404);
						return;
					}

					console.log('returning friend relationship');
					res.json(Friend);

				});


			});

	});

	app.get('/friends/friend', function(req, res) {
		console.log("Finding all friends for user");

		checkUserAuth(req, res)
			.then(function(user){

				var conditions = {
					user_id: user._id,
					type: 'friend',
					active: true
				}

				m.Friend.find(conditions)
				.populate('friend_id')
				.exec(function(err, Friends){

					var toReturn = [];
					Friends.forEach(function(tmpFriend){
						console.log(tmpFriend);
						toReturn.push(m.User.toProfile(tmpFriend.friend_id));
					});

					console.log('returning');
					res.json(toReturn);
				});


			});

	});

	app.get('/friends/emailonly', function(req, res) {
		console.log("Finding all email-only friends for user");

		checkUserAuth(req, res)
			.then(function(user){

				var conditions = {
					user_id: user._id,
					type: 'emailonly',
					active: true
				}

				m.Friend.find(conditions)
				.populate('friend_id')
				.exec(function(err, Friends){
					if(err){
						errorhandler(err, res);
						return;
					}
					// var toReturn = [];
					// Friends.forEach(function(tmpFriend){
					// 	console.log(tmpFriend);
					// 	toReturn.push(m.User.toProfile(tmpFriend.friend_id));
					// });

					// console.log('returning');
					// res.json(toReturn);
					res.json(Friends);

				});


			});

	});

	app.get('/friends/recommended', function(req, res) {
		console.log("Finding all people recommended by other people");

		// should be able to separate/sort by skills/categories/industries! 

		checkUserAuth(req, res)
			.then(function(user){

				// Find my friends 

				var conditions = {
					user_id: user._id,
					type: 'friend',
					active: true
				}

				m.Friend.find(conditions)
				// .populate('friend_id')
				.exec(function(err, Friends){
					if(err){
						errorhandler(err, res);
						return;
					}

					var user_ids = _.map(Friends, function(tmpFriend){
						return tmpFriend.friend_id;
					});

					var theyConditions = {
						user_id: {
							'$in' : user_ids
						},
						friend_id: {
							'$ne' : user._id, // not me!
							'$nin' : user_ids
						},
						recommend: true,
						type: 'friend',
						active: true
					}

					// Find the people they recommend
					// - who I'm not already friends with
					m.Friend.find(theyConditions)
					.populate('friend_id')
					.exec(function(err, Friends){

						// should include WHO has the relationship with the person? 

						var toReturn = [];
						Friends.forEach(function(tmpFriend){
							console.log(tmpFriend);
							toReturn.push(m.User.toProfile(tmpFriend.friend_id));
						});

						console.log('returning');
						res.json(toReturn);
					});
				});
				

			});

	});

	// app.get('/friends/:friend_type', function(req, res) {
	// 	console.log("Finding all friends for user");

	// 	checkUserAuth(req, res)
	// 		.then(function(user){

	// 			var conditions = {
	// 				user_id: user._id,
	// 				type: req.params.friend_type,
	// 				active: true
	// 			}

	// 			switch(req.params.friend_type){
	// 				case 'friend':
	// 					break;
	// 				case 'potential':
	// 					break;
	// 				default:
	// 					errorhandler(null, res);
	// 					break;
	// 			}
	// 			m.Friend.find(conditions)
	// 			.populate('friend_id')
	// 			.exec(function(err, Friends){

	// 				var toReturn = [];
	// 				Friends.forEach(function(tmpFriend){
	// 					console.log(tmpFriend);
	// 					toReturn.push(m.User.toProfile(tmpFriend.friend_id));
	// 				});

	// 				console.log('returning');
	// 				res.json(toReturn);
	// 			});

	// 		});

	// });

	app.patch('/friend/:friend_id', function(req, res) {
		console.log("Recommend or de-recommend a friend");

		checkUserAuth(req, res)
			.then(function(user){
				var friend_id = ObjectID(req.params.friend_id);
				
				var conditions = {
					friend_id: friend_id,
					user_id: user._id
				};

				// Find Friend

				m.Friend.findOne(conditions)
				.exec(function (err, Friend) {
					if (err){
						console.log('alt_models error');
						res.status(500);
						res.json(false);
						return;
					}

					if(!Friend){
						errorhandler('failed finding friend relationship', res);
						return;
					}

					var body = req.body;


					// Stars
					if(body.hasOwnProperty('recommend')){
						
						var recommendValue = ['true', true, 1].indexOf(body.recommend) !== -1 ? true : false;
						console.log(body);
						console.log('recommendValue', recommendValue);
						console.log(body.recommend);
						console.log(typeof body.recommend);

						// Update/Insert stars
						Friend.recommend = recommendValue;
						Friend.save(function(err, newFriend){
							if (err){
								console.log('alt_models error');
								res.status(500);
								res.json(false);
								return;
							}

							// Should return a new Game object, right!
							res.json(true);

						});

						return;

					} else {
						console.error('Missing recommend for friend');
						res.status(500);
						res.json({
							msg: "Missing recommend for friend"
						});
						return;
					}


				});

			});
			
	});


	app.post('/friend/connect', function(req, res){

		console.log('Connecting two people');

		checkUserAuth(req, res)
			.then(function(user){

				var body = req.body;

				console.log(body);

				// Find the other person
				m.User.findOne({_id: ObjectID(body.friend_id)})
				.exec(function(err, otherUser){
					if(err){
						errorhandler(err, res);
						return;
					}

					// Found other user?
					if(!otherUser){
						errorhandler(err, res, 415, 'No user found');
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

							res.json({
								code: 200,
								_id: otherUser._id,
								type: 'friend'
							});
							return;

							// m.Friend.update({
							// 	'$or' : [{
							// 		user_id: user._id,
							// 		friend_id: otherUser._id
							// 	},{
							// 		user_id: otherUser._id,
							// 		friend_id: user._id
							// 	}]
							// },{
							// 	type: 'friend', // "upgrading" the status
							// 	active: true,
							// 	modified: new Date()
							// },{
							// 	multi: true,
							// 	upsert: false
							// },function(err, numAffected){
							// 	if(err){
							// 		console.error(err);
							// 	}
							// 	if(numAffected != 2){
							// 		console.error('Oh shit, wrong number of friends affected', numAffected);
							// 	}
							// });
						} else {

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
						}


						// // Update me
						// user.update({
						// 	'$addToSet' : {
						// 		'friends' : otherUser._id
						// 	}
						// },
						// {},
						//  function(err, result){
						// 	if(err){
						// 		console.error('Failed saving that friend 3497111');
						// 		console.error(err);
						// 		return;
						// 	}
						// 	console.log('Updated my friend list OK');
						// });

						// // Update _them_
						// otherUser.update({
						// 	'$addToSet' : {
						// 		'friends' : user._id
						// 	}
						// },
						// {},
						//  function(err, result){
						// 	if(err){
						// 		console.error('Failed saving that friend 32498');
						// 		console.error(err);
						// 		return;
						// 	}
						// 	console.log('Updated their friend list OK');
						// });

						// Notify the other person!
						m.PushNotification.pushToUser(otherUser, {
							ios_title: 'New Connection: ' + user.profile.name,
							title: 'New Connection',
							message: user.profile.name,
							payload: {type: 'new_connection', id: user._id, name: user.profile.name}
						}, 'new_connection', {});
						
						console.log('Connected two friends!');

						// Aight, saved probably!
						res.json({
							code: 200,
							_id: otherUser._id,
							type: 'friend'
						});

					
					});

				});

		});


	});
	

	app.post('/friend/emailonly', function(req, res) {
		console.log("Creating a new EmailOnly friend");

		checkUserAuth(req, res)
			.then(function(user){
				console.log(user);

				// Test the URI against Stripe
				// - todo...
				console.log('Should check against stripe too');

				var body = req.body;

				var Friend = new m.Friend({
					user_id: user._id,
					type: 'emailonly',
					name: body.name,
					email: body.email.toString().toLowerCase(),
					active: true
				});

				// Save the friend
				Friend.save(function(err, newFriend){
					if(err){
						errorhandler(err, res);
						return;
					}

					console.log('Saved new email-only friend!');
					res.json(newFriend);
				});

			});
			
	});

	// app.get('/friend/potential_list/:hash', function(req, res) {
	// 	console.log("Finding all potential matches and returning them");

	// 	checkUserAuth(req, res)
	// 		.then(function(user){

	// 			// Get hash (room)
	// 			var hash = req.params.hash ? req.params.hash : 'default';
	// 			hash = hash.toString().toLowerCase();

	// 			var my_gps_coords = [req.query.lng ? req.query.lng : 0, req.query.lat ? req.query.lat : 0];

	// 			var coords = {
	// 				type: 'Point',
	// 				coordinates: my_gps_coords // notice the order of longitude, latitude! (backwards-ish)
	// 			};

	// 			// Add me to the Hash
	// 			var roomConditions = {
	// 				user_id: user._id,
	// 				hash: hash
	// 			};
	// 			// console.log('updateData');
	// 			// console.log(updateData);
	// 			m.UserPotentialRoomHash.findOne(roomConditions)
	// 			.exec(function(err, MyRoomHash){ 
	// 				if(err){
	// 					// Failed
	// 					console.error('Failed UserPotentialRoomHash');
	// 					console.error(err);
	// 					errorhandler(err, res);
	// 					return;
	// 				}

	// 				if(MyRoomHash){
	// 					// exists, update it
	// 					MyRoomHash.modified = new Date();
	// 					MyRoomHash.save(function(err, newMyRoomHash){
	// 						if(err){
	// 							console.error('failed updating myRoomHash');
	// 						}
	// 					});
	// 					return;
	// 				}

	// 				// doesn't exist, create it

	// 				var MyRoomHash = new m.UserPotentialRoomHash({
	// 					user_id: user._id,
	// 					hash: hash,
	// 					coords: coords
	// 				});

	// 				MyRoomHash.save(function(err, newMyRoomHash){
	// 					if(err){
	// 						console.error('failed updating myRoomHash');
	// 					}
	// 					console.log('saved new MyRoomHash');
	// 				});

	// 			});

	// 			// Determine who to avoid showing again
	// 			var toAvoidPromises = [];

	// 			console.log('toAvoidPromises start');

	// 			// Users I've already made a decision on
	// 			var decidedOnPromise = Q.defer();
	// 			toAvoidPromises.push(decidedOnPromise.promise);
	// 			var friendConditions = {
	// 				user_id: user._id
	// 			};
	// 			m.UserPotentialFriendResult.find(friendConditions)
	// 			.exec(function(err, decidedOn){
	// 				if(err){
	// 					errorhandler(err, res);
	// 					return;
	// 				}

	// 				console.log('decidedOn');

	// 				var decidedOnResult = [];

	// 				// iterate over decidedOn friends (exclude them)
	// 				decidedOn.forEach(function(tmpUser){
	// 					decidedOnResult.push(tmpUser.potential_friend_id);
	// 				});

	// 				decidedOnPromise.resolve(decidedOnResult);

	// 			});

	// 			// Existing Friends
	// 			var existingFriendsPromise = Q.defer();
	// 			toAvoidPromises.push(existingFriendsPromise.promise);
	// 			var existingFriendConditions = {
	// 				user_id: user._id,
	// 				type: 'friend'
	// 			};
	// 			m.Friend.find(existingFriendConditions)
	// 			.exec(function(err, results){
	// 				if(err){
	// 					errorhandler(err, res);
	// 					return;
	// 				}

	// 				console.log('existingFriendResult');

	// 				var existingFriendResult = [];

	// 				// iterate over decidedOn friends (exclude them)
	// 				results.forEach(function(tmpUser){
	// 					existingFriendResult.push(tmpUser.friend_id);
	// 				});

	// 				existingFriendsPromise.resolve(existingFriendResult);

	// 			});

	// 			// Matched Potential Friends
	// 			var potentialFriendsPromise = Q.defer();
	// 			toAvoidPromises.push(potentialFriendsPromise.promise);
	// 			var potentialFriendConditions = {
	// 				user_id: user._id,
	// 				type: 'potential',
	// 				active: true
	// 			};
	// 			m.Friend.find(potentialFriendConditions)
	// 			.exec(function(err, results){
	// 				if(err){
	// 					errorhandler(err, res);
	// 					return;
	// 				}

	// 				console.log('potentialFriendResult');

	// 				var potentialFriendResult = [];

	// 				// iterate over decidedOn friends (exclude them)
	// 				results.forEach(function(tmpUser){
	// 					potentialFriendResult.push(tmpUser.friend_id);
	// 				});

	// 				potentialFriendsPromise.resolve(potentialFriendResult);

	// 			});

	// 			Q.all(toAvoidPromises)
	// 			.then(function(results){

	// 				console.log('all results');
	// 				console.log(results);

	// 				var ids_to_avoid = _.flatten(results);
	// 				// _.each(results, function(tmp){
	// 				// // results.forEach(function(tmp){
	// 				// 	console.log('tmp', tmp);
	// 				// 	ids_to_avoid.concat(_.flatten(tmp));
	// 				// });

	// 				console.log('ids_to_avoid');
	// 				console.log(ids_to_avoid);

	// 				// Include my id as one to avoid!
	// 				ids_to_avoid.push(user._id);

	// 				// Now we have a list of ids we want to ignore!


	// 				// Build list of users I might match with! 

	// 				// enrolled in hash
	// 				// - within the last 30 days
	// 				var hashConditions = {
	// 					user_id: {
	// 						'$nin' : ids_to_avoid
	// 					},
	// 					hash: hash,
	// 					created: {
	// 						'$gte' : moment().subtract('days', 30)
	// 					}
	// 				};

	// 				// OK, do we need to limit to location too?
	// 				// - only on default tag
	// 				// - ...old thinking: within a certain radius (which should depend on the hash, and how many people are in there!)
	// 				if(hash == 'default_near'){
	// 					hashConditions.coords = {
	// 						'$near' : {
	// 							type: 'Point',
	// 							coordinates: my_gps_coords
	// 						},
	// 						'$maxDistance' : 10000 // meters
	// 					};
	// 				}

	// 				m.UserPotentialRoomHash.find(hashConditions)
	// 				.sort({modified: -1}) // sort by most-recently-active
	// 				.limit(1000)
	// 				.exec(function(err, potential_users){
	// 					if(err){
	// 						errorhandler(err, res);
	// 						return;
	// 					}

	// 					console.log('got list, hashConditions:');
	// 					console.log(hashConditions);

	// 					console.log('potential users');
	// 					console.log(potential_users);

	// 					// OK, got our list...
	// 					// - randomize and show the user?

	// 					var shuffled = _.shuffle(potential_users);

	// 					var shuffled_ids = _.pluck(shuffled, 'user_id');

	// 					console.log('shuffled_ids');
	// 					console.log(shuffled_ids);

	// 					if(!shuffled_ids.length){
	// 						res.json([]);
	// 						return;
	// 					}

	// 					console.log('shuffle2');
	// 					console.log(shuffled_ids);

	// 					// Grab those users
	// 					m.User.find({
	// 						_id: {
	// 							'$in' : shuffled_ids
	// 						},
	// 						profilephoto: {
	// 							'$exists' : true
	// 						}
	// 					})
	// 					.populate('profilephoto')
	// 					.exec(function(err, users){
	// 						if(err){
	// 							console.error('finding shuffled error');
	// 							errorhandler(err, res);
	// 							return;
	// 						}

	// 						var tmpUsers = [];
	// 						users.forEach(function(tmpUser){
								
	// 							tmpUsers.push({
	// 								_id: tmpUser._id,
	// 								profilephoto: tmpUser.profilephoto
	// 								// name: tmpUser.profile.name,
	// 								// media: <-- fill this out, don't return the name
	// 							});
	// 						});

	// 						console.log('returning some number of users!');
	// 						console.log(tmpUsers.length);

	// 						res.json(tmpUsers);

	// 					});


	// 				});

	// 			});



	// 			// var conditions = {
	// 			// 	_id: {
	// 			// 		'$ne': user._id
	// 			// 	}
	// 			// };

	// 			// m.User.find(conditions)
	// 			// // .limit(25)
	// 			// .exec(function(err, users){
	// 			// 	if(err){
	// 			// 		console.error(err);
	// 			// 		return;
	// 			// 	}
	// 			// 	var tmpUsers = [];
	// 			// 	users.forEach(function(tmpUser){
						
	// 			// 		tmpUsers.push({
	// 			// 			_id: tmpUser._id,
	// 			// 			name: tmpUser.profile.name,
	// 			// 			// media: <-- fill this out, don't return the name
	// 			// 		});
	// 			// 	});

	// 			// 	tmpUsers = _.sortBy(tmpUsers, function(u){
	// 			// 		return Math.random(0,100);
	// 			// 	});

	// 			// 	console.log('returning potential matches');
	// 			// 	console.log(tmpUsers);
	// 			// 	res.json(tmpUsers.splice(0,10));

	// 			// });

	// 		});

	// });

	// app.post('/friend/potential/decision', function(req, res){
	// 	console.log('Making a decision on a potential friend');

	// 	checkUserAuth(req, res)
	// 		.then(function(user){

	// 			var decision_user_id = ObjectID(req.body.user_id),
	// 				decision = req.body.decision == true ? true : false;

	// 			console.log(req.body);
	// 			console.log(req.body.decision);
	// 			// Update UserPotentialFriendResults
	// 			// - upsert

	// 			// Get PotentialFriend
	// 			m.User.findOne({
	// 				_id: decision_user_id
	// 			},function(err, PotentialFriend){
	// 				if(err){
	// 					errorhandler(err, res);
	// 					return;
	// 				}

	// 				if(!PotentialFriend){
	// 					console.error('unable to find user');
	// 					errorhandler(null, res);
	// 					return;
	// 				}

	// 				var conditions = {
	// 					user_id: user._id,
	// 					potential_friend_id: decision_user_id
	// 				};

	// 				m.UserPotentialFriendResult.findOne(conditions)
	// 				.exec(function(err, result){
	// 					if(err){
	// 						errorhandler(err, res);
	// 						return;
	// 					}

	// 					if(result){
	// 						// already exists, update
	// 						result.update({
	// 							allow: decision,
	// 							modified: new Date()
	// 						}, function(err, newResult){
	// 							console.log('updated old decision');

	// 							// should check for new matches here, correct?
	// 							// -todo..

	// 							res.json(true);
	// 						});

	// 						return;
	// 					}

	// 					// Create
	// 					var Result = new m.UserPotentialFriendResult({
	// 						user_id: user._id,
	// 						potential_friend_id: decision_user_id,
	// 						allow: decision
	// 					});

	// 					Result.save(function(err, newResult){
	// 						if(err){
	// 							return;
	// 						}
	// 						console.log('saved new decision');

	// 						// should check for new matches here, correct?
	// 						// - they would have chosen me too
	// 						if(decision == true){
	// 							m.UserPotentialFriendResult.findOne({
	// 								user_id: decision_user_id,
	// 								potential_friend_id: user._id,
	// 								allow: true
	// 							})
	// 							.exec(function(err, results){
	// 								if(err){
	// 									console.error(err);
	// 									return;
	// 								}

	// 								// Found some results?
	// 								if(!results){
	// 									// not found
	// 									return;
	// 								}

	// 								// Create the result!
	// 								var meFriend = new m.Friend({
	// 									user_id: user._id,
	// 									friend_id: PotentialFriend._id,
	// 									type: 'potential',
	// 									active: true
	// 								});
	// 								meFriend.save(function(err, newFriend){
	// 									if(err){
	// 										console.error(err);
	// 										return;
	// 									}
	// 									console.log('saved meFriend');
	// 								});
	// 								var themFriend = new m.Friend({
	// 									user_id: PotentialFriend._id,
	// 									friend_id: user._id,
	// 									type: 'potential',
	// 									active: true
	// 								});
	// 								themFriend.save(function(err, newFriend){
	// 									if(err){
	// 										console.error(err);
	// 										return;
	// 									}
	// 									console.log('saved themFriend');
	// 								});

	// 								// Notify me! 
	// 								m.PushNotification.pushToUser(user._id, {
	// 									ios_title: 'New Potential Match: ' + PotentialFriend.profile.name,
	// 									title: 'New Potential Friend',
	// 									message: PotentialFriend.profile.name,
	// 									payload: {type: 'new_potential_friend', id: PotentialFriend._id, name: PotentialFriend.profile.name}
	// 								}, 'new_potential_friend', {});

	// 								// Notify them! 
	// 								m.PushNotification.pushToUser(PotentialFriend._id, {
	// 									ios_title: 'New Potential Match: ' + user.profile.name,
	// 									title: 'New Potential Friend',
	// 									message: user.profile.name,
	// 									payload: {type: 'new_potential_friend', id: user._id, name: user.profile.name}
	// 								}, 'new_potential_friend', {});

	// 							});
	// 						}

	// 						res.json(true);
	// 					});

	// 				});

	// 			});

	// 		});

	// });


}