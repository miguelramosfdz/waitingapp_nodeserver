
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {
  
	app.get('/payment_sources', function(req, res) {
		console.log("Finding all payment sources for a user");

		checkUserAuth(req, res)
			.then(function(user){
				m.PaymentSource.find({user_id: user._id}, function(err, sources){
					if(err){
						res.status(500);
						res.json(err);
						return;
					}

					console.log('Sources');
					console.log(sources);

					res.json(sources);
				});
			});
	});


	app.post('/payment_source', function(req, res) {
		console.log("Creating a new Payment Source");

		// Uses balanced payments marketplace
		// - credit card is the only method supported at the moment

		checkUserAuth(req, res)
			.then(function(user){
				console.log(user);

				// Test the URI against Stripe
				// - todo...
				console.log('Should check against stripe too');

				// User can have a bunch of sources (credit cards) to pay with/from
				var PaymentSource = new m.PaymentSource({
					user_id: user._id,
					name: req.body.name, // name of the card to save (personal, business) etc
					last4: req.body.last4,
					token: req.body.token,
					cardid: req.body.cardid,
					type: req.body.type,
					active: true,
					created: new Date()
				});

				PaymentSource.save(function(err, psource){
					if(err){
						console.log('Failed saving PaymentSource account');
						res.status(500);
						res.json(false);
						return;
					}

					console.log('Created payment source');

					// Saved PaymentSource Account for user
					res.json(psource);

				});

				// test the card on the server too
				// - and the customer too
				if(!user.customer){
					console.log('creating customer');
					// console.log(models.stripe);
 					// need to create a customer for this user too
 					try {
	 					models.stripe.customers.create({
							description: 'user_id: ' + user._id.toString(),
							card: req.body.token
						}, function(err, customer) {
							if(err){
								console.log('Failed creating customer');
								console.log(err);
								return;
							}
							// customer created
							console.log('customer created for user');
							user.customer = customer.id;
							// console.log(user);
							user.save(function(err, user){
								if(err){
									console.log('Failed updating user with new customer data');
									return;
								}
								console.log('Updated user with new customer data');
							});
							console.log('after saving user with customer');
						});
	 				} catch(err){
	 					console.log(err);
	 				}
					console.log('created ok');

				} else {
					// Add the card to the customer
					console.log('adding card to cusomter');
					models.stripe.customers.createCard(
						user.customer,
						{card: req.body.token},
						function(err, card) {
							if(err){
								console.log('Failed adding card to existing customer');
								return;
							}

							console.log('Successfully added card to customer');

						}
					);

				}

			});
			
	});

	// app.get('/payment_source/:source_id', function(req, res) {
	// 	console.log("Individual driver");

	// 	checkUserAuth(req, res)
	// 		.then(function(user){
	// 			var driverId = ObjectID(req.params.driver_id);
	// 			var collection = models.mongo.collection('drivers');
	// 			collection.find({ '_id': driverId, user_id : user._id }).toArray(function(err, items) {
	// 				if(!items || items.length < 1){
	// 					res.json({});
	// 				} else {
	// 					res.json(items[0]);
	// 				}
	// 			});

	// 		});
			
	// });
	// app.put('/driver/:driver_id', function(req, res) {
	// 	console.log("Individual driver updating");

	// 	checkUserAuth(req, res)
	// 		.then(function(user){
	// 			var driverId = ObjectID(req.params.driver_id);
	// 			var collection = models.mongo.collection('drivers');
	// 			var user_collection = models.mongo.collection('users');

	// 			var objs = matcher(req.body);
	// 			objs = no_id(objs);

	// 			// Find the Driver first
	// 			// - if we're updating the Email address, then we want to search for a new Driver and get them all connected up!
	// 			collection.find({ '_id': driverId, user_id : user._id }).toArray(function(err, items) {
	// 				if(err){
	// 					res.status(500);
	// 					res.json({});
	// 					return false;
	// 				}
	// 				if(!items || items.length < 1){
	// 					res.json({});
	// 				}

	// 				var driver = items[0];

	// 				objs.email = objs.email.toString().toLowerCase();

	// 				if(driver.email != objs.email && driver.is_me != 1){
	// 					// reset the connected_user_id
	// 					// - we'll be saving it later
	// 					objs.connected_user_id = null;
	// 				}

	// 				// Changing the email?
	// 				if(driver.email != objs.email && driver.is_me != 1 && validateEmail(objs.email)){
	// 					console.log('Updating the email address');

	// 					// reset the connected_user_id
	// 					// - we'll be saving it later
	// 					objs.connected_user_id = null;

	// 					// See if any existing user exists with that email address
	// 					user_collection.find({ 'email': objs.email }).toArray(function(err, foundUsers) {
	// 						if(err){
	// 							res.status(500);
	// 							res.json({});
	// 							return false;
	// 						}
	// 						if(!foundUsers || foundUsers.length < 1){
	// 							// Found nobody
	// 							// - fuckin create 'em
	// 							// - easier than having a sign-up I suppose!

	// 							// Create the user
	// 							models.createNewUser({email: objs.email})
	// 								.then(function(result){
	// 									if(result.complete != true){
	// 										// Failed creating the user for some reason
	// 										console.log('ERROR: Failed creating the user for some reason');
	// 										console.log(result);
	// 										return;
	// 									}

	// 									objs.connected_user_id = result.user_id;

	// 									// Update!
	// 									objs = matcher(objs); // _id formatting ObjectId()

	// 									// Run Update
	// 									console.log('Updating2');
	// 									console.log(objs);
	// 									collection.update(
	// 										{ '_id': driverId, user_id : user._id },
	// 										{'$set' : objs},
	// 										{multi : false},
	// 										function(err, updated){
	// 											console.log('Updated');
	// 											console.log(updated);
	// 											if(err){
	// 												console.log('err');
	// 												console.log(err);
	// 											}
	// 											res.json(objs);
	// 										});
										
	// 									// Send email to the new user
	// 									console.log('Sending email');
	// 									var emailText = user.email + ' has invited you to join Wehicle! Download the iOS or Android app and signup with the email: ' + objs.email + ' and password: ' + result.password;
	// 									console.log(emailText);
	// 									models.email.send({
	// 										to: objs.email,
	// 										from: 'founders@wehicleapp.com',
	// 										subject: 'You have been invited to join Wehicle!',
	// 										text: emailText
	// 									});

	// 								});

	// 						} else {
	// 							// Found a single user (good)
	// 							// - update the objs and save it (finally)
	// 							objs.connected_user_id = foundUsers[0]._id;

	// 							// Update!
	// 							objs = matcher(objs); // _id formatting ObjectId()

	// 							// Run Update
	// 							console.log('Updating2');
	// 							console.log(objs);
	// 							collection.update(
	// 								{ '_id': driverId, user_id : user._id },
	// 								{'$set' : objs},
	// 								{multi : false},
	// 								function(err, updated){
	// 									console.log('Updated');
	// 									console.log(updated);
	// 									if(err){
	// 										console.log('err');
	// 										console.log(err);
	// 									}
	// 									res.json(objs);
	// 								});

	// 						}

	// 					});


	// 				} else {

	// 					// Run Update
	// 					console.log('Updating');
	// 					console.log(objs);
	// 					console.log(typeof objs.user_id);
	// 					collection.update(
	// 						{ '_id': driverId, user_id : user._id },
	// 						{'$set' : objs},
	// 						{multi : false},
	// 						function(err, updated){
	// 							console.log('Updated');
	// 							console.log(updated);
	// 							if(err){
	// 								console.log('err');
	// 								console.log(err);
	// 							}
	// 							res.json(objs);
	// 						});

	// 				}

	// 			});


	// 		});
			
	// });


}