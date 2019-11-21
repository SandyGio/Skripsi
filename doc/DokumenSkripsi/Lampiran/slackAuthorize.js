var express = require('express');
var router = express.Router();
var authHelper = require('../helper/auth');

/* GET /authorize. */
router.get('/', async function(req, res, next) {
  // Get auth code
  const code = req.query.code;

  token = await authHelper.getTokenFromCodeSlack(code);
  res.render('slack_authorize_success');

});

module.exports = router;
