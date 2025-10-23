/**
 * Mortality Monitor Service
 *
 * Smart mortality tracking and alerting system that monitors mortality rates
 * per batch and sends notifications when thresholds are exceeded.
 *
 * Alert Levels:
 * - Normal: < 2% daily mortality rate
 * - Warning: 2-5% daily mortality rate (yellow alert)
 * - Critical: 5-10% daily mortality rate (orange alert)
 * - Emergency: > 10% daily mortality rate (red alert)
 *
 * Smart Features:
 * - Age-adjusted thresholds (higher tolerance for young chicks)
 * - Batch type-specific thresholds (broiler vs layer)
 * - Cumulative mortality tracking
 * - Trend analysis (increasing/stable/decreasing)
 * - Automatic notifications with actionable recommendations
 */

import notificationService from './notificationService';
import fastDatabase from './fastDatabase';

class MortalityMonitor {
  constructor() {
    // Default thresholds (percentage of current flock size)
    this.thresholds = {
      broiler: {
        // Age in weeks -> daily mortality % thresholds
        ageBasedDaily: {
          week1: { warning: 3, critical: 6, emergency: 10 },    // Week 1: Higher tolerance
          week2: { warning: 2, critical: 4, emergency: 8 },     // Week 2: Moderate tolerance
          week3Plus: { warning: 1.5, critical: 3, emergency: 6 } // Week 3+: Lower tolerance
        },
        // Cumulative mortality over entire cycle
        totalCycle: { warning: 5, critical: 8, emergency: 12 }
      },
      layer: {
        ageBasedDaily: {
          week1: { warning: 2.5, critical: 5, emergency: 9 },
          week2: { warning: 1.5, critical: 3, emergency: 6 },
          week3Plus: { warning: 1, critical: 2, emergency: 5 }
        },
        totalCycle: { warning: 4, critical: 7, emergency: 10 }
      },
      // Default for other bird types
      default: {
        ageBasedDaily: {
          week1: { warning: 2.5, critical: 5, emergency: 9 },
          week2: { warning: 2, critical: 4, emergency: 7 },
          week3Plus: { warning: 1.5, critical: 3, emergency: 6 }
        },
        totalCycle: { warning: 5, critical: 8, emergency: 12 }
      }
    };

    // Alert cooldown to prevent spam (in milliseconds)
    this.alertCooldown = 4 * 60 * 60 * 1000; // 4 hours
    this.lastAlerts = {}; // { batchId: timestamp }
  }

  /**
   * Calculate batch age in weeks from arrival date
   */
  getBatchAgeInWeeks(arrivalDate) {
    if (!arrivalDate) return 0;

    const arrival = new Date(arrivalDate);
    const now = new Date();
    const ageInDays = Math.floor((now - arrival) / (1000 * 60 * 60 * 24));
    return Math.floor(ageInDays / 7);
  }

  /**
   * Get age-appropriate thresholds for a batch
   */
  getThresholdsForBatch(batch) {
    const ageInWeeks = this.getBatchAgeInWeeks(batch.arrivalDate || batch.arrival_date);
    const birdType = (batch.birdType || batch.bird_type || 'default').toLowerCase();

    // Select bird type thresholds
    let typeThresholds = this.thresholds.default;
    if (birdType.includes('broiler')) {
      typeThresholds = this.thresholds.broiler;
    } else if (birdType.includes('layer')) {
      typeThresholds = this.thresholds.layer;
    }

    // Select age-based thresholds
    let ageThresholds;
    if (ageInWeeks === 0) {
      ageThresholds = typeThresholds.ageBasedDaily.week1;
    } else if (ageInWeeks === 1) {
      ageThresholds = typeThresholds.ageBasedDaily.week2;
    } else {
      ageThresholds = typeThresholds.ageBasedDaily.week3Plus;
    }

    return {
      daily: ageThresholds,
      total: typeThresholds.totalCycle,
      ageInWeeks
    };
  }

  /**
   * Calculate mortality rate for today
   */
  async getTodayMortalityRate(batchId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's mortality records for this batch
      const records = fastDatabase.db.getAllSync(
        `SELECT SUM(count) as totalDeaths
         FROM mortality_records
         WHERE batch_id = ?
         AND DATE(COALESCE(date, death_date, created_at)) = DATE(?)
         AND is_deleted = 0`,
        [batchId, today]
      );

      const todayDeaths = records[0]?.totalDeaths || 0;

      // Get batch current count
      const batch = fastDatabase.getBatchById(batchId);
      const currentCount = batch?.current_count || batch?.currentCount || 0;

      // CRITICAL FIX: Calculate rate based on population BEFORE today's deaths
      // Current count has already been reduced by today's deaths, so add them back
      const populationBeforeDeaths = currentCount + todayDeaths;

      console.log(`📊 Today's mortality calculation for batch ${batchId}:`);
      console.log(`  - Deaths today: ${todayDeaths}`);
      console.log(`  - Current count (after deaths): ${currentCount}`);
      console.log(`  - Population before deaths: ${populationBeforeDeaths}`);
      console.log(`  - Rate: ${todayDeaths} / ${populationBeforeDeaths} = ${((todayDeaths / populationBeforeDeaths) * 100).toFixed(2)}%`);

      // Calculate rate (deaths / population before deaths * 100)
      if (populationBeforeDeaths === 0) return 0;
      return (todayDeaths / populationBeforeDeaths) * 100;

    } catch (error) {
      console.error('❌ Error calculating today mortality rate:', error);
      return 0;
    }
  }

  /**
   * Calculate cumulative mortality rate since batch start
   */
  async getCumulativeMortalityRate(batchId) {
    try {
      // Get total deaths since batch start
      const records = fastDatabase.db.getAllSync(
        `SELECT SUM(count) as totalDeaths
         FROM mortality_records
         WHERE batch_id = ?
         AND is_deleted = 0`,
        [batchId]
      );

      const totalDeaths = records[0]?.totalDeaths || 0;

      // Get batch initial count
      const batch = fastDatabase.getBatchById(batchId);
      const initialCount = batch?.initial_count || batch?.initialCount || 0;

      // Calculate rate (total deaths / initial population * 100)
      if (initialCount === 0) return 0;
      return (totalDeaths / initialCount) * 100;

    } catch (error) {
      console.error('❌ Error calculating cumulative mortality rate:', error);
      return 0;
    }
  }

  /**
   * Get mortality trend (last 7 days)
   */
  async getMortalityTrend(batchId) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateLimit = sevenDaysAgo.toISOString().split('T')[0];

      const records = fastDatabase.db.getAllSync(
        `SELECT DATE(COALESCE(date, death_date, created_at)) as date, SUM(count) as deaths
         FROM mortality_records
         WHERE batch_id = ?
         AND DATE(COALESCE(date, death_date, created_at)) >= DATE(?)
         AND is_deleted = 0
         GROUP BY DATE(COALESCE(date, death_date, created_at))
         ORDER BY date DESC
         LIMIT 7`,
        [batchId, dateLimit]
      );

      if (records.length < 2) return 'insufficient_data';

      // Simple trend analysis: compare first half vs second half
      const midpoint = Math.floor(records.length / 2);
      const recentAvg = records.slice(0, midpoint).reduce((sum, r) => sum + (r.deaths || 0), 0) / midpoint;
      const olderAvg = records.slice(midpoint).reduce((sum, r) => sum + (r.deaths || 0), 0) / (records.length - midpoint);

      if (recentAvg > olderAvg * 1.5) return 'increasing';
      if (recentAvg < olderAvg * 0.7) return 'decreasing';
      return 'stable';

    } catch (error) {
      console.error('❌ Error calculating mortality trend:', error);
      return 'unknown';
    }
  }

  /**
   * Determine alert level based on mortality rate
   */
  determineAlertLevel(rate, thresholds) {
    if (rate >= thresholds.emergency) return 'emergency';
    if (rate >= thresholds.critical) return 'critical';
    if (rate >= thresholds.warning) return 'warning';
    return 'normal';
  }

  /**
   * Get alert message and recommendations based on level and trend
   */
  getAlertMessage(level, rate, trend, batch, thresholds) {
    const batchName = batch.batch_name || batch.batchName || 'Unknown Batch';
    const farmName = batch.farmName || 'Unknown Farm';
    const rateStr = rate.toFixed(2);

    const messages = {
      emergency: {
        title: `🚨 EMERGENCY: High Mortality in ${batchName}`,
        body: `${rateStr}% mortality rate today (threshold: ${thresholds.emergency}%). Immediate action required!`,
        recommendations: [
          '🩺 Contact veterinarian immediately',
          '🔬 Submit samples for lab testing',
          '🏥 Isolate sick birds if possible',
          '🧹 Review biosecurity measures',
          '💊 Check medication/vaccination schedule'
        ]
      },
      critical: {
        title: `⚠️ CRITICAL: Elevated Mortality in ${batchName}`,
        body: `${rateStr}% mortality rate today (threshold: ${thresholds.critical}%). Urgent attention needed.`,
        recommendations: [
          '🩺 Schedule veterinarian visit today',
          '🌡️ Check environmental conditions (temp, humidity)',
          '💧 Verify water quality and availability',
          '🍽️ Check feed quality and consumption',
          '👁️ Inspect flock for signs of disease'
        ]
      },
      warning: {
        title: `⚡ WARNING: Mortality Alert for ${batchName}`,
        body: `${rateStr}% mortality rate today (threshold: ${thresholds.warning}%). Monitor closely.`,
        recommendations: [
          '📊 Monitor flock closely over next 24 hours',
          '🌡️ Verify temperature and ventilation',
          '💧 Check water and feed supply',
          '📝 Document any symptoms observed',
          '📞 Prepare to contact vet if trend continues'
        ]
      }
    };

    const alert = messages[level];
    if (!alert) return null;

    // Add trend information
    const trendText = {
      increasing: '📈 Trend: INCREASING - situation worsening',
      decreasing: '📉 Trend: Decreasing - situation improving',
      stable: '➡️ Trend: Stable',
      insufficient_data: '📊 Trend: Not enough data',
      unknown: ''
    };

    return {
      ...alert,
      trend: trendText[trend] || '',
      farmName,
      batchName,
      rate: rateStr
    };
  }

  /**
   * Check if alert cooldown period has passed
   */
  canSendAlert(batchId) {
    const lastAlert = this.lastAlerts[batchId];
    if (!lastAlert) return true;

    const timeSinceLastAlert = Date.now() - lastAlert;
    return timeSinceLastAlert >= this.alertCooldown;
  }

  /**
   * Send notification for mortality alert
   */
  async sendAlert(alertMessage) {
    try {
      console.log('📢 Sending mortality alert:', alertMessage.title);

      // Format notification body with recommendations
      const body = [
        alertMessage.body,
        '',
        alertMessage.trend,
        '',
        'Recommendations:',
        ...alertMessage.recommendations.map((r, i) => `${i + 1}. ${r}`)
      ].filter(Boolean).join('\n');

      // Use scheduleLocalNotification with data and 1 second delay (immediate)
      await notificationService.scheduleLocalNotification(
        alertMessage.title,
        body,
        {
          type: 'mortality_alert',
          level: alertMessage.level || 'warning',
          batchName: alertMessage.batchName,
          farmName: alertMessage.farmName,
          rate: alertMessage.rate
        },
        1 // Send after 1 second
      );

      console.log('✅ Mortality alert notification scheduled');
      return true;
    } catch (error) {
      console.error('❌ Error sending mortality alert:', error);
      return false;
    }
  }

  /**
   * Main monitoring function - called after mortality record is created
   */
  async checkMortalityAlert(batchId, mortalityCount) {
    try {
      console.log(`🔍 Checking mortality alert for batch ${batchId}, deaths: ${mortalityCount}`);

      // Get batch details
      const batch = fastDatabase.getBatchById(batchId);
      if (!batch) {
        console.warn('⚠️ Batch not found for mortality check');
        return null;
      }

      // Get farm details for batch
      const farm = fastDatabase.getFarmById(batch.farm_id || batch.farmId);
      if (farm) {
        batch.farmName = farm.farm_name || farm.farmName || farm.name;
      }

      // Get age-appropriate thresholds
      const { daily, total, ageInWeeks } = this.getThresholdsForBatch(batch);
      console.log(`📊 Batch age: ${ageInWeeks} weeks, Thresholds:`, daily);

      // Calculate today's mortality rate
      const todayRate = await this.getTodayMortalityRate(batchId);
      console.log(`📈 Today's mortality rate: ${todayRate.toFixed(2)}%`);

      // Calculate cumulative mortality rate
      const cumulativeRate = await this.getCumulativeMortalityRate(batchId);
      console.log(`📊 Cumulative mortality rate: ${cumulativeRate.toFixed(2)}%`);

      // Get mortality trend
      const trend = await this.getMortalityTrend(batchId);
      console.log(`📉 Mortality trend: ${trend}`);

      // Determine alert level for daily rate
      const dailyAlertLevel = this.determineAlertLevel(todayRate, daily);

      // Determine alert level for cumulative rate
      const cumulativeAlertLevel = this.determineAlertLevel(cumulativeRate, total);

      // Use the higher severity level
      const alertLevel = this.getHigherSeverity(dailyAlertLevel, cumulativeAlertLevel);
      console.log(`⚠️ Alert level: ${alertLevel} (daily: ${dailyAlertLevel}, cumulative: ${cumulativeAlertLevel})`);

      // Send alert if needed
      if (alertLevel !== 'normal') {
        // Check cooldown to prevent spam
        if (!this.canSendAlert(batchId)) {
          console.log('⏰ Alert cooldown active, skipping notification');
          return {
            level: alertLevel,
            rate: todayRate,
            cumulativeRate,
            trend,
            alerted: false,
            reason: 'cooldown'
          };
        }

        // Get alert message
        const alertMessage = this.getAlertMessage(alertLevel, todayRate, trend, batch, daily);

        // Send notification
        const sent = await this.sendAlert(alertMessage);

        if (sent) {
          // Update last alert timestamp
          this.lastAlerts[batchId] = Date.now();

          console.log(`✅ Mortality alert sent for batch ${batchId}`);

          return {
            level: alertLevel,
            rate: todayRate,
            cumulativeRate,
            trend,
            alerted: true,
            message: alertMessage
          };
        }
      }

      return {
        level: alertLevel,
        rate: todayRate,
        cumulativeRate,
        trend,
        alerted: false,
        reason: alertLevel === 'normal' ? 'within_normal_range' : 'send_failed'
      };

    } catch (error) {
      console.error('❌ Error checking mortality alert:', error);
      return null;
    }
  }

  /**
   * Get higher severity level between two alert levels
   */
  getHigherSeverity(level1, level2) {
    const severity = { normal: 0, warning: 1, critical: 2, emergency: 3 };
    const level1Severity = severity[level1] || 0;
    const level2Severity = severity[level2] || 0;

    const higherSeverity = Math.max(level1Severity, level2Severity);
    return Object.keys(severity).find(key => severity[key] === higherSeverity) || 'normal';
  }

  /**
   * Get mortality status for a batch (for dashboard display)
   */
  async getBatchMortalityStatus(batchId) {
    try {
      const batch = fastDatabase.getBatchById(batchId);
      if (!batch) return null;

      const { daily, total, ageInWeeks } = this.getThresholdsForBatch(batch);
      const todayRate = await this.getTodayMortalityRate(batchId);
      const cumulativeRate = await this.getCumulativeMortalityRate(batchId);
      const trend = await this.getMortalityTrend(batchId);

      const dailyAlertLevel = this.determineAlertLevel(todayRate, daily);
      const cumulativeAlertLevel = this.determineAlertLevel(cumulativeRate, total);
      const overallLevel = this.getHigherSeverity(dailyAlertLevel, cumulativeAlertLevel);

      return {
        batchId,
        batchName: batch.batch_name || batch.batchName,
        ageInWeeks,
        todayRate,
        cumulativeRate,
        trend,
        alertLevel: overallLevel,
        thresholds: { daily, total }
      };
    } catch (error) {
      console.error('❌ Error getting batch mortality status:', error);
      return null;
    }
  }

  /**
   * Get all batches with active mortality alerts
   */
  async getActiveMortalityAlerts() {
    try {
      const batches = fastDatabase.getBatches();
      const alerts = [];

      for (const batch of batches) {
        if (batch.status === 'completed' || batch.is_deleted) continue;

        const status = await this.getBatchMortalityStatus(batch.id);
        if (status && status.alertLevel !== 'normal') {
          alerts.push(status);
        }
      }

      return alerts;
    } catch (error) {
      console.error('❌ Error getting active mortality alerts:', error);
      return [];
    }
  }
}

// Export singleton instance
const mortalityMonitor = new MortalityMonitor();
export default mortalityMonitor;
