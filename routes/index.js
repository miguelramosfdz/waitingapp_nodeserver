module.exports = function(app) {

	app.get('/', function(req, res) {
		res.render("index", { pageTitle: config.get('app_name')});
	});

  app.get('/support', function(req, res) {
    res.render("support", { pageTitle: config.get('app_name')});
  });

  
  require('./invite')(app);
  require('./friend')(app);
  require('./media')(app);
  require('./message')(app);
  require('./payment_source')(app);
  require('./push')(app);
  require('./relationship_code')(app);
  require('./user')(app);
  require('./webhook')(app);

}