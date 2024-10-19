const express = require('express');
const app = express();
const port = 3000;
const mysql = require('mysql2');

// 设置数据库连接
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '0000',
  database: 'mlb'  // 你可以设置一个默认数据库
});

connection.connect();

// 获取年份列表
app.get('/api/years', (req, res) => {
  connection.query('SHOW DATABASES', (error, results) => {
    if (error) {
      console.error('Error fetching years:', error);
      return res.status(500).json({ error: error.message });
    }
    const years = results.map(row => row.Database).filter(db => /^\d{4}$/.test(db));
    res.json(years);
  });
});

// 获取指定年份的投手名单
app.get('/api/pitchers', (req, res) => {
  const { year } = req.query;
  connection.query(`SHOW TABLES FROM \`${year}\``, (error, results) => {
    if (error) {
      console.error('Error fetching pitchers:', error);
      return res.status(500).json({ error: error.message });
    }
    const pitchers = results.map(row => Object.values(row)[0]);
    res.json(pitchers);
  });
});

// 获取投球数据
app.get('/api/data', (req, res) => {
  const { year, pitcher, balls, strikes } = req.query;
  const query = `
    SELECT pitch_name, COUNT(*) as count
    FROM \`${year}\`.\`${pitcher}\`
    WHERE balls = ? AND strikes = ?
    GROUP BY pitch_name
  `;
  connection.query(query, [balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      return res.status(500).json({ error: error.message });
    }
    const data = results.map(row => ({
      category: row.pitch_name,
      value: row.count
    }));
    res.json(data);
  });
});

// 获取投球位置数据
app.get('/api/zones', (req, res) => {
  const { year, pitcher, balls, strikes } = req.query;
  const query = `
    SELECT zone, COUNT(*) as count
    FROM \`${year}\`.\`${pitcher}\`
    WHERE balls = ? AND strikes = ?
    GROUP BY zone
  `;
  connection.query(query, [balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching zones:', error);
      return res.status(500).json({ error: error.message });
    }
    const data = results.map(row => ({
      zone: row.zone,
      count: row.count
    }));
    res.json(data);
  });
});

// 获取打者名单
app.get('/api/batters', (req, res) => {
  const { year } = req.query;
  connection.query('SHOW TABLES FROM batter', (error, results) => {
    if (error) {
      console.error('Error fetching batters:', error);
      return res.status(500).json({ error: error.message });
    }

    const batters = results.map(row => Object.values(row)[0]);
    const filteredBatters = [];

    batters.forEach((batter) => {
      const query = `SELECT 1 FROM batter.\`${batter}\` WHERE year = ? LIMIT 1`;
      connection.query(query, [year], (err, rows) => {
        if (err) {
          console.error('Error filtering batters by year:', err);
          return res.status(500).json({ error: err.message });
        }
        if (rows.length > 0) {
          filteredBatters.push(batter);
        }

        if (filteredBatters.length === batters.length) {
          res.json(filteredBatters);
        }
      });
    });
  });
});

// 获取打者数据
app.get('/api/data2', (req, res) => {
  const { year, batter, balls, strikes } = req.query;
  const query = `
    SELECT pitch_name, COUNT(*) as count
    FROM batter.\`${batter}\`
    WHERE year = ? AND balls = ? AND strikes = ?
    GROUP BY pitch_name
  `;
  connection.query(query, [year, balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching data:', error);
      return res.status(500).json({ error: error.message });
    }
    const data = results.map(row => ({
      category: row.pitch_name,
      value: row.count
    }));
    res.json(data);
  });
});

// 获取打者的打击率
app.get('/api/batting-average', (req, res) => {
  const { year, batter, balls, strikes } = req.query;
  const query = `
    SELECT events, COUNT(*) as count
    FROM batter.\`${batter}\`
    WHERE year = ? AND balls = ? AND strikes = ?
    GROUP BY events
  `;
  connection.query(query, [year, balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching batting average data:', error);
      return res.status(500).json({ error: error.message });
    }

    let hits = 0;
    let atBats = 0;

    results.forEach(row => {
      const event = row.events;
      const count = row.count;

      if (['single', 'double', 'home_run', 'triple'].includes(event)) {
        hits += count;
      }

      if (['single', 'double', 'home_run', 'triple', 'field_out', 'strikeout', 'grounded_into_double_play', 'force_out', 'double_play', 'fielders_choice'].includes(event)) {
        atBats += count;
      }
    });

    const battingAverage = (atBats > 0) ? (hits / atBats).toFixed(3) : 0;

    res.json({ battingAverage });
  });
});
  
// 获取打者的投球位置数据
app.get('/api/zones2', (req, res) => {
  const { year, batter, balls, strikes } = req.query;
  const zonesQuery = `
    SELECT zone FROM (
      SELECT 1 as zone UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
      SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION
      SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
    ) as zones
  `;
  const dataQuery = `
    SELECT zones.zone,
           COALESCE(SUM(CASE WHEN events IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END), 0) AS hits,
           COUNT(events) AS atBats
    FROM (${zonesQuery}) as zones
    LEFT JOIN batter.\`${batter}\` ON zones.zone = batter.\`${batter}\`.zone
      AND year = ? AND balls = ? AND strikes = ?
    GROUP BY zones.zone
  `;
  connection.query(dataQuery, [year, balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching zones:', error);
      return res.status(500).json({ error: error.message });
    }
    const data = results.map(row => ({
      zone: row.zone,
      battingAverage: (row.atBats > 0 ? (row.hits / row.atBats).toFixed(3) : 0),
      count: row.atBats
    }));
    res.json(data);
    
  });
});

// 获取打者面对不同球种的打击率
app.get('/api/pitch-stats', (req, res) => {
  const { year, batter, balls, strikes } = req.query;
  const query = `
    SELECT pitch_name, 
           SUM(CASE WHEN events IN ('single', 'double', 'triple', 'home_run') THEN 1 ELSE 0 END) as hits,
           COUNT(*) as atBats
    FROM batter.\`${batter}\`
    WHERE year = ? AND balls = ? AND strikes = ?
      AND events IN ('single', 'double', 'triple', 'home_run', 'field_out', 'strikeout', 'grounded_into_double_play', 'force_out', 'double_play', 'fielders_choice')
    GROUP BY pitch_name
  `;
  connection.query(query, [year, balls, strikes], (error, results) => {
    if (error) {
      console.error('Error fetching pitch stats:', error);
      return res.status(500).json({ error: error.message });
    }
    const data = results.map(row => ({
      pitch_name: row.pitch_name,
      batting_average: row.atBats > 0 ? (row.hits / row.atBats).toFixed(3) : 0
    }));
    res.json(data);
  });
});
app.get('/api/pitcher-details', (req, res) => {
  const { year, pitcher } = req.query;
  const query = `
      SELECT Player, W, L, ERA, K, WHIP,IP,BB
      FROM yearpitcher.\`${year}\`
      WHERE Player = ?
  `;
  connection.query(query, [pitcher], (error, results) => {
      if (error) {
          console.error('Error fetching pitcher details:', error);
          return res.status(500).json({ error: error.message });
      }
      res.json(results[0] || {});
  });
});
app.get('/api/batter-details', (req, res) => {
  const { year, batter } = req.query;
  const query = `
    SELECT AVG, H, HR, RBI, OPS, SLG
    FROM yearbatter.\`${year}\`
    WHERE Player = ?
  `;
  connection.query(query, [batter], (error, results) => {
    if (error) {
      console.error('Error fetching batter details:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json(results[0] || {});
  });
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
