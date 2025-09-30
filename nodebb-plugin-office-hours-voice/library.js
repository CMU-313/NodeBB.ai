const Controllers = {};

Controllers.init = function (params, callback) {
  const { router, middleware } = params;

  // Serve a simple page if someone visits /office-hours (optional)
  router.get('/office-hours', middleware.buildHeader, (req, res) => {
    res.render('office-hours', { title: 'Office Hours' });
  });

  // Queue page for office hours
  router.get('/office-hours/queue', middleware.buildHeader, (req, res) => {
    res.render('office-hours-queue', { title: 'Office Hours Queue' });
  });

  callback();
};

module.exports = Controllers;
