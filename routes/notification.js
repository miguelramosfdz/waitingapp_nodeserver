
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {
  
	app.post('/notification', function(req, res) {
		console.log("Creating a new player");

		checkUserAuth(req, res)
			.then(function(user){

				// Get the Parent Notification for creating the base set of rules/schema

				var parentNotificationId = ObjectID(req.body.parent_notification_id);

				m.Notification.find({_id: parentNotificationId}, function(err, notifications){
					if(err){
						console.log('Err: 3298h', err);
						res.status(500);
						res.json(false);
						return;
					}

					if(notifications.length < 1){
						console.log('Unable to find Parent Notification');
						res.status(404);
						res.json(false);
						return;
					}

					var ParentNotification = notifications[0];

					// Cannot edit or modify an existing Game's schema or important details/rules/scoring
					// - can change the name
					// - have versioned notifications? (why not?, games evolve!)
					// - todo...

					// Set defaults
					var Notification = new m.Notification({
						user_id: user._id,
						parent_notification_id: ParentNotification._id,
						
						name: req.body.name,

						team_game: "allowed",
						team_game_default: false,

						result_type: req.body.result_type,
						result_subtype: req.body.result_subtype,

						result_schema: {},

						ties_allowed: req.body.ties_allowed !== false ? true:false,

						// Example:			
					    // "_id" : ObjectId("539210c45399dfc47bc702f8"),
					    // "name" : "Chess",
					    // "user_id" : ObjectId("5391389586b0a41158c45979"),
					    // "parent_notification_id" : null,
					    // "result_type" : "1v1",
					    // "ties_allowed" : true,
					    // "details" : {
					    //     "opponents" : 1,
					    //     "result_type" : "single_option",
					    //     "result_subtype" : "win_lose_tie",
					    //     "result_options" : [ 
					    //         "win", 
					    //         "lose", 
					    //         "tie"
					    //     ],
					    //     "detail_options" : [ 
					    //         {
					    //             "key" : "blackwhite",
					    //             "question" : "Were you Black or White",
					    //             "type" : "toggle",
					    //             "default" : null,
					    //             "answers" : [ 
					    //                 "Black", 
					    //                 "White"
					    //             ]
					    //         }
					    //     ]
					    // },
					    // "game_schema" : {
					    //     "winner_id" : null,
					    //     "loser_id" : null,
					    //     "tie" : 0,
					    //     "black_id" : null,
					    //     "white_id" : null
					    // },
					    // "created" : ISODate("2014-06-06T19:04:36.014Z"),
					    // "modified" : ISODate("2014-06-06T19:04:36.014Z")

					});

					Notification.save(
						function(err, savedObj){
							console.log('Saved');
							// console.log(savedObj);
							if(err){
								console.log('err');
								console.log(err);
								res.status(500);
								res.json(false);
								return;
							}
							res.json(savedObj);
						});

				})
			});
			
	});

	app.get('/notification/:notification_id', function(req, res) {
		console.log("Individual notification");

		checkUserAuth(req, res)
			.then(function(user){
				var notificationId = ObjectID(req.params.notification_id);
				var conditions = { 
					_id: notificationId, 
					// user_id : user._id 
				};
				m.Notification.find(conditions, function(err, items) {
					if(!items || items.length < 1){
						res.json({});
					} else {
						res.json(items[0]);
					}
				});
			});
			
	});

	app.patch('/notification/:notification_id', function(req, res) {
		console.log("Patching Individual Notification");

		checkUserAuth(req, res)
			.then(function(user){
				var notificationId = ObjectID(req.params.notification_id);
				
				var conditions = {
					_id: notificationId,
					user_id: user._id
				};

				// Test the notification

				m.Notification.findOne(conditions)
				// .populate('car_id')
				.exec(function (err, Notification) {
					if (err){
						console.log('alt_models error');
						res.status(500);
						res.json(false);
						return;
					}
					
					var body = req.body;
					if(body.hasOwnProperty('player_id')){
						Notification.player_id = body.player_id;
					}
					if(body.hasOwnProperty('riders')){
						Notification.riders = body.riders;
					}

					Notification.save(function(err, newNotification){
						if(err){
							console.log('Failed updating newNotification');
							res.status(500);
							res.json(false);
							console.log(err);
							return;
						}
						res.json(newNotification);
					});

				});

			});
			
	});

	// app.put('/notification/:notification_id', function(req, res) {
	// 	console.log("Individual notification updating");

	// 	checkUserAuth(req, res)
	// 		.then(function(user){
	// 			var notificationId = ObjectID(req.params.notification_id);
	// 			var collection = models.mongo.collection('notifications');
	// 			console.log(req.body);

	// 			var objs = matcher(req.body);
	// 			objs = no_id(objs);

	// 			console.log('Updating');
	// 			console.log(objs);

	// 			console.log(typeof objs.user_id);

	// 			// res.json(req.body);

	// 			collection.update(
	// 				{ '_id': notificationId, user_id : user._id },
	// 				{'$set' : objs},
	// 				{multi : false},
	// 				function(err, updated){
	// 					console.log('Updated');
	// 					console.log(updated);
	// 					if(err){
	// 						console.log('err');
	// 						console.log(err);
	// 					}
	// 					res.json(req.body);
	// 				});
	// 		});
			
	// });

	app.get('/notifications', function(req, res) {
		console.log("Finding all notifications in db for a user");

		checkUserAuth(req, res)
			.then(function(user){

				// Need to get all the Notifications I can possibly access, via Players I'm connected to
				// - technically I can access any Notification, right?

				// // Get user's of Player's I've created
				// var created = Q.defer();
				// m.Player.find({ user_id: user._id }, function(err, players){
				// 	created.resolve(players);
				// });

				// // Get user's of Player's who I was connected with
				// var connected = Q.defer();
				// m.Player.find({ connected_user_id: user._id }, function(err, players){
				// 	connected.resolve(players);
				// });

				// Q.all([created.promise, connected.promise])
				// 	.spread(function(createdResults, connectedResults){

				// 		var user_ids = [];
				// 		createdResults.forEach(function(cResult){
				// 			if(cResult.connected_user_id){
				// 				user_ids.push(cResult.connected_user_id);
				// 			}
				// 		});
				// 		connectedResults.forEach(function(cResult){
				// 			user_ids.push(cResult.user_id);
				// 		});

						// Get subset of notifications and total results
						// var conditions = {
						// 	user_id : {
						// 			"$in" : user_ids
						// 		}
						// 	};
						var conditions = {
							// active: true
						};
						var fields = null, // null = all fields
							options = {
								skip: req.query['$skip'] || 0, // skip
								limit: req.query['$top'] || null, // limit
								sort: {_id : -1}
							};
						if(req.query['$filter']){
							conditions = {
								'$and' : [conditions, JSON.parse(req.query['$filter'])]
							};
						}

						var findResult = Q.defer();
						m.Notification.find(conditions,fields,options)
						.populate('user_id')
						.exec(function (err, results) {
							if (err){ // TODO handle err
								console.log('alt_models error');
								return;
							}
							findResult.resolve(results);
						});

						var countResult = Q.defer();
						m.Notification.count(conditions, function (err, count) {
							if(err){
								console.log('Err 238947');
							}
							countResult.resolve(count);
						});

						Q.all([findResult.promise, countResult.promise])
							.spread(function(results, totalResults){
								res.json({
									results: results,
									total: totalResults
								});
							});

					// });

			});

	});

	// app.get('/notifications/player/:player_id', function(req, res) {
	// 	console.log("Finding all SPORTS for notifications db for player");
		
	// 	checkUserAuth(req, res)
	// 		.then(function(user){
	// 			var playerId = ObjectID(req.params.player_id);

	// 			// var players_collection = models.mongo.collection('players');
	// 			// var notifications_collection = models.mongo.collection('notifications');

	// 			// Need to know if the player we're looking at is my PlayerHome
	// 			// - in which case we're getting all of the notifications for my connected_user_id's too

	// 			var conditions = {_id: playerId, user_id: user._id};
	// 			m.Player.find(conditions, function(err, players){	
	// 			// players_collection.find({_id: playerId, user_id: user._id}).toArray(function(err, players) {

	// 				if(err){
	// 					res.status(500);
	// 					res.json([]);
	// 					return;
	// 				}

	// 				// Got the player?
	// 				if(players.length < 1){
	// 					res.status(404);
	// 					res.json(false);
	// 					return;
	// 				}

	// 				var player = players[0];

	// 				// Is the player Me?
	// 				var playerSearchObj = {};
	// 				if(player.is_me){

	// 					playerSearchObj = {"$or" : [{
	// 							_id: playerId, 
	// 							user_id : user._id
	// 						},{
	// 							connected_user_id: user._id
	// 						}]
	// 					};
	// 				} else {

	// 					playerSearchObj = {
	// 						_id: playerId, 
	// 						user_id : user._id
	// 					};
					
	// 				}

	// 				// players_collection.find(playerSearchObj).toArray(function(err, players) {
	// 				m.Player.find(playerSearchObj, function(err, players){

	// 					if(err || players.length < 1){
	// 						// res.status(404);
	// 						console.log(err);
	// 						console.log(players.length);
	// 						res.json(false);
	// 						return;
	// 					}

	// 					// Got players

	// 					// // Gather all the notifications for a player
	// 					// // - also gathering all the Notifications that I took driving another car
	// 					// // - we aren't expecting much overlap between the two
	// 					// notifications_collection.find().toArray(function(err, items) {
	// 					// 	// res.json(items.splice(-10,10));
	// 					// 	res.json(items);
	// 					// });

	// 					// Gather all the notifications for a player
	// 					// - also gathering all the Notifications that I took driving another car
	// 					// - we aren't expecting much overlap between the two

	// 					// Get subset of notifications and total results
	// 					var conditions = {player_id: { "$in" : _.pluck(players, '_id')}},
	// 						fields = null, // null = all fields
	// 						options = {
	// 							skip: req.query['$skip'] || 0, // skip
	// 							limit: req.query['$top'] || null, // limit
	// 							sort: {_id : -1}
	// 						};
	// 					if(req.query['$filter']){
	// 						conditions = {
	// 							'$and' : [conditions, JSON.parse(req.query['$filter'])]
	// 						};
	// 					}
	// 					var findResult = Q.defer();
	// 					m.Notification.find(conditions,fields,options, function (err, results) {
	// 						if (err){ // TODO handle err
	// 							console.log('alt_models error');
	// 							return;
	// 						}
	// 						findResult.resolve(results);
	// 					})

	// 					var countResult = Q.defer();
	// 					m.Notification.count(conditions, function (err, count) {
	// 						if(err){
	// 							console.log('Err 238947');
	// 						}
	// 						countResult.resolve(count);
	// 					})

	// 					Q.all([findResult.promise, countResult.promise])
	// 						.spread(function(results, totalResults){
	// 							res.json({
	// 								results: results,
	// 								total: totalResults
	// 							});
	// 						});


	// 				});


	// 			});

	// 		});

	// });


}