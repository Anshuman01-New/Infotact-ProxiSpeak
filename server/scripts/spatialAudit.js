/**
 * ProxiSpeak - CLI Spatial Audit Benchmark Runner
 *
 * Week 2 Requirement:
 * "Spatial Audit: Prove the backend accurately filters and clusters users
 * based on geospatial coordinates under 20ms."
 *
 * Usage:
 *   npm run audit
 */

const { connectDB, disconnectDB } = require('../src/config/db');
const { runSpatialAudit } = require('../src/services/auditService');

async function main() {
  console.log('\n======================================================');
  console.log('🔬 PROXISPEAK GEOSPATIAL AUDIT BENCHMARK');
  console.log('Target: Proximity query & clustering latency < 20ms');
  console.log('======================================================\n');

  try {
    await connectDB();

    const testScenarios = [
      { users: 20, queries: 50, label: 'Small Office (20 users)' },
      { users: 50, queries: 100, label: 'Standard Office (50 users - Project Spec)' },
      { users: 100, queries: 100, label: 'High Density Office (100 users)' },
    ];

    const resultsSummary = [];

    for (const scenario of testScenarios) {
      console.log(`Running benchmark for ${scenario.label}...`);
      const res = await runSpatialAudit({
        userCount: scenario.users,
        queryCount: scenario.queries,
      });

      resultsSummary.push({
        Scenario: scenario.label,
        'Users Count': res.metrics.simulatedUsers,
        'Queries Run': res.metrics.queriesExecuted,
        'Min (ms)': res.metrics.minLatencyMs,
        'Avg (ms)': res.metrics.avgLatencyMs,
        'P95 (ms)': res.metrics.p95LatencyMs,
        'P99 (ms)': res.metrics.p99LatencyMs,
        'Cluster Time (ms)': res.metrics.clusteringLatencyMs,
        'Status (<20ms)': res.status,
      });
    }

    console.log('\n📊 BENCHMARK RESULTS TABLE:');
    console.table(resultsSummary);

    const allPassed = resultsSummary.every((r) => r['Status (<20ms)'] === 'PASSED');

    if (allPassed) {
      console.log('\n✅ AUDIT VERIFICATION SUCCESSFUL!');
      console.log('All geospatial queries and clustering executed comfortably UNDER the 20ms target requirement.\n');
    } else {
      console.error('\n❌ AUDIT VERIFICATION FAILED: One or more scenarios exceeded 20ms.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Audit execution error:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
