function getWeather(req, res) {
  const rain = req.query.rain === 'true' || (!req.query.rain && req.app.locals.weatherCondition === 'rain');
  res.json({
    success: true,
    data: { weather: rain
      ? { condition: 'Rain expected', temperature: 24, icon: 'rain', alert: 'Rain expected in 15 mins' }
      : { condition: 'Clear', temperature: 26, icon: 'sun', alert: null } }
  });
}

function simulateWeather(req, res) {
  if (req.body.condition !== 'rain') return res.status(400).json({ success: false, message: 'Weather condition is invalid.' });
  const condition = 'rain';
  req.app.locals.weatherCondition = condition;
  res.json({ success: true, data: { condition } });
}

function restoreWeather(req, res) {
  req.app.locals.weatherCondition = 'clear';
  res.json({ success: true, data: { condition: 'clear' } });
}

module.exports = { getWeather, simulateWeather, restoreWeather };
