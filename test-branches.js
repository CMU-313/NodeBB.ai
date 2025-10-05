#!/usr/bin/env node

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// CSV output filename will be set dynamically based on task string
const NODEBB_STARTUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const NODEBB_CHECK_INTERVAL = 5000; // Check every 5 seconds

// Helper function to execute shell commands
function exec(command, options = {}) {
	try {
		return execSync(command, {
			encoding: 'utf8',
			stdio: options.silent ? 'pipe' : 'inherit',
			...options,
		});
	} catch (error) {
		if (options.ignoreError) {
			return error.stdout || '';
		}
		throw error;
	}
}

// Get current branch
function getCurrentBranch() {
	return exec('git branch --show-current', { silent: true }).trim();
}

// Get all branches containing a specific task string
function getTaskBranches(taskString) {
	const output = exec('git branch -a', { silent: true });
	const branches = output.split('\n')
		.map(b => b.trim().replace(/^\*\s+/, '').replace(/^remotes\/origin\//, ''))
		.filter(b => b.includes(taskString) && b !== '' && !b.includes('HEAD ->'));

	// Remove duplicates
	return [...new Set(branches)];
}

// Parse Mocha test output
function parseTestResults(output) {
	// Look for patterns like "4650 passing" or "146 failing"
	const passMatch = output.match(/(\d+)\s+passing/i);
	const failMatch = output.match(/(\d+)\s+failing/i);

	const passed = passMatch ? parseInt(passMatch[1]) : 0;
	const failed = failMatch ? parseInt(failMatch[1]) : 0;

	return {
		passed,
		failed,
	};
}

// Run tests and return results with filtered output
function runTests() {
	console.log('  Running tests...');
	const startTime = Date.now();

	return new Promise((resolve) => {
		const testProcess = spawn('npm', ['test'], {
			stdio: ['inherit', 'pipe', 'pipe'],
		});

		let output = '';
		let buffer = '';

		// Filter patterns - lines starting with these will be suppressed
		const suppressPatterns = [
			/^info:/,
			/^error:/,
			/^warn:/,
			/^verbose:/,
			/^debug:/,
			/^\s*→/,
			/^Parsing upgrade scripts/,
			/^Schema update complete/,
			/^OK \|/,
			/^\[1G/,
			/^before \[\]/,
		];

		const shouldSuppress = (line) => {
			return suppressPatterns.some(pattern => pattern.test(line));
		};

		const processLine = (line) => {
			if (!shouldSuppress(line) && line.trim()) {
				process.stdout.write(line + '\n');
			}
		};

		testProcess.stdout.on('data', (data) => {
			output += data.toString();
			buffer += data.toString();

			const lines = buffer.split('\n');
			buffer = lines.pop(); // Keep incomplete line in buffer

			lines.forEach(processLine);
		});

		testProcess.stderr.on('data', (data) => {
			output += data.toString();
			// Suppress stderr entirely (most verbose logs)
		});

		testProcess.on('close', (code) => {
			if (buffer.trim()) {
				processLine(buffer);
			}

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			const results = parseTestResults(output);

			// Debug: Check if we got results
			if (results.passed === 0 && results.failed === 0 && output.length > 0) {
				console.log('\n  [DEBUG] Could not parse test results. Last 500 chars of output:');
				console.log(output.slice(-500));
			}

			console.log(`  ✓ Tests completed in ${elapsed}s: ${results.passed} passed, ${results.failed} failed`);
			resolve({
				success: results.failed === 0 && results.passed > 0,
				...results,
			});
		});
	});
}

// Check if NodeBB is running
async function checkNodeBBRunning() {
	try {
		// Check if the nodebb process is running by looking for the PID file
		const pidFile = path.join(__dirname, 'pidfile');
		if (fs.existsSync(pidFile)) {
			const pid = fs.readFileSync(pidFile, 'utf8').trim();
			try {
				// Check if process exists
				process.kill(pid, 0);
				return true;
			} catch (e) {
				return false;
			}
		}
		return false;
	} catch (error) {
		return false;
	}
}

// Start NodeBB and verify it starts successfully
async function startNodeBB() {
	console.log('  Starting NodeBB...');
	console.log('  ----------------------------------------');

	try {
		// Start NodeBB
		exec('./nodebb start', { silent: false });

		console.log('  Waiting for NodeBB to start (timeout: 5 minutes)...');

		// Wait and check if it started successfully
		const startTime = Date.now();
		let checkCount = 0;
		while (Date.now() - startTime < NODEBB_STARTUP_TIMEOUT) {
			await new Promise(resolve => setTimeout(resolve, NODEBB_CHECK_INTERVAL));

			checkCount++;
			const isRunning = await checkNodeBBRunning();
			if (isRunning) {
				const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
				console.log('  ----------------------------------------');
				console.log(`  ✓ NodeBB started successfully (${elapsed}s)`);
				return true;
			}

			const elapsed = Math.round((Date.now() - startTime) / 1000);
			const remaining = Math.round((NODEBB_STARTUP_TIMEOUT - (Date.now() - startTime)) / 1000);
			console.log(`  [Check ${checkCount}] Still waiting... (${elapsed}s elapsed, ${remaining}s remaining)`);
		}

		console.log('  ----------------------------------------');
		console.log('  ✗ NodeBB failed to start within timeout (5 minutes)');
		return false;
	} catch (error) {
		console.log('  ----------------------------------------');
		console.log(`  ✗ NodeBB failed to start: ${error.message}`);
		return false;
	}
}

// Stop NodeBB
function stopNodeBB() {
	console.log('  ----------------------------------------');
	console.log('  Stopping NodeBB...');
	try {
		exec('./nodebb stop', { silent: false });
		// Give it a moment to shut down
		execSync('sleep 3');
		console.log('  ✓ NodeBB stopped');
	} catch (error) {
		console.log(`  ⚠ Warning: Error stopping NodeBB: ${error.message}`);
	}
}

// Test a single branch
async function testBranch(branchName, index, total) {
	console.log('\n========================================');
	console.log(`Testing branch ${index}/${total}: ${branchName}`);
	console.log('========================================');

	const result = {
		branch: branchName,
		testsPassed: 0,
		testsFailed: 0,
		nodebbStarted: 'No',
	};

	const branchStartTime = Date.now();

	try {
		// Checkout branch (reset specific files that might have changes)
		console.log('\n  [Step 1/3] Checking out branch...');
		// Reset specific files that commonly get modified during tests
		exec('git checkout -- package-lock.json package.json vendor/nodebb-theme-harmony-2.1.15/library.js 2>/dev/null || true', { silent: true });
		exec(`git checkout ${branchName}`, { silent: false });
		console.log('  ✓ Branch checked out');

		// Run tests
		console.log('\n  [Step 2/3] Running tests...');
		const testResults = await runTests();
		result.testsPassed = testResults.passed;
		result.testsFailed = testResults.failed;

		// If tests failed, mark and skip NodeBB startup
		if (!testResults.success) {
			result.nodebbStarted = 'tests failed';
			console.log('\n  ⚠ Skipping NodeBB startup due to test failures');
			const elapsed = ((Date.now() - branchStartTime) / 1000).toFixed(1);
			console.log(`\n  Branch completed in ${elapsed}s`);
			return result;
		}

		// Tests passed, try to start NodeBB
		console.log('\n  [Step 3/3] Starting NodeBB...');
		const started = await startNodeBB();
		result.nodebbStarted = started ? 'Yes' : 'No';

		// Stop NodeBB if it started
		if (started) {
			stopNodeBB();
		}

		const elapsed = ((Date.now() - branchStartTime) / 1000).toFixed(1);
		console.log(`\n  Branch completed in ${elapsed}s`);
	} catch (error) {
		console.log(`\n  ✗ Error testing branch: ${error.message}`);
		result.nodebbStarted = `Error: ${error.message}`;
	}

	return result;
}

// Write results to CSV
function writeCSV(results, taskString) {
	const csvOutput = `branch-test-results-${taskString}.csv`;
	const headers = 'Branch Name,Tests Passed,Tests Failed,NodeBB Started Successfully\n';
	const rows = results.map(r =>
		`${r.branch},${r.testsPassed},${r.testsFailed},${r.nodebbStarted}`).join('\n');

	fs.writeFileSync(csvOutput, headers + rows);
	console.log(`\nResults written to ${csvOutput}`);
	return csvOutput;
}

// Main function
async function main() {
	console.log('Branch Testing Script');
	console.log('===================\n');

	// Parse command line arguments
	// Usage: node test-branches.js [limit] [task-string]
	// Examples:
	//   node test-branches.js           -> all branches with "task-1"
	//   node test-branches.js 5         -> first 5 branches with "task-1"
	//   node test-branches.js task-2    -> all branches with "task-2"
	//   node test-branches.js 5 task-2  -> first 5 branches with "task-2"

	let limit = null;
	let taskString = 'task-1'; // default

	// Parse arguments
	const args = process.argv.slice(2);
	for (const arg of args) {
		const numArg = parseInt(arg);
		if (!isNaN(numArg) && numArg > 0) {
			limit = numArg;
		} else {
			taskString = arg;
		}
	}

	// Save current branch
	const originalBranch = getCurrentBranch();
	console.log(`Current branch: ${originalBranch}`);
	console.log(`Task string: ${taskString}`);

	// Get branches to test
	let branches = getTaskBranches(taskString);
	console.log(`Found ${branches.length} branches with "${taskString}"`);

	// Apply limit if specified
	if (limit && limit > 0) {
		branches = branches.slice(0, limit);
		console.log(`Limiting to first ${limit} branches\n`);
	} else {
		console.log('Testing all branches\n');
	}

	console.log('Branches to test:');
	branches.forEach(b => console.log(`  - ${b}`));

	if (branches.length === 0) {
		console.log('No branches found. Exiting.');
		return;
	}

	// Test each branch
	console.log(`\n${'='.repeat(80)}`);
	console.log('STARTING BRANCH TESTING');
	console.log(`${'='.repeat(80)}\n`);

	const results = [];
	const totalBranches = branches.length;
	const startTime = Date.now();

	for (let i = 0; i < branches.length; i++) {
		const branch = branches[i];
		const result = await testBranch(branch, i + 1, totalBranches);
		results.push(result);

		// Show progress summary after each branch
		const completed = i + 1;
		const remaining = totalBranches - completed;
		const elapsed = (Date.now() - startTime) / 1000;
		const avgTime = elapsed / completed;
		const estimatedRemaining = Math.round(avgTime * remaining / 60);

		console.log(`\n${'='.repeat(80)}`);
		console.log(`PROGRESS: ${completed}/${totalBranches} branches tested (${remaining} remaining)`);
		console.log(`Elapsed time: ${(elapsed / 60).toFixed(1)} minutes`);
		if (remaining > 0) {
			console.log(`Estimated time remaining: ${estimatedRemaining} minutes`);
		}
		console.log(`${'='.repeat(80)}`);
	}

	// Restore original branch
	console.log(`\n\nRestoring original branch: ${originalBranch}`);
	try {
		exec(`git checkout ${originalBranch}`, { silent: false });
		console.log('✓ Branch restored');
	} catch (error) {
		console.log(`⚠ Warning: Could not restore original branch: ${error.message}`);
	}

	// Write CSV
	const csvOutput = writeCSV(results, taskString);

	// Calculate statistics
	const totalTime = ((Date.now() - startTime) / 60000).toFixed(1);
	const successfulStarts = results.filter(r => r.nodebbStarted === 'Yes').length;
	const testFailures = results.filter(r => r.nodebbStarted === 'tests failed').length;
	const startupFailures = results.filter(r => r.nodebbStarted === 'No').length;
	const errors = results.filter(r => r.nodebbStarted.startsWith('Error')).length;

	// Print summary
	console.log(`\n\n${'='.repeat(80)}`);
	console.log('FINAL SUMMARY');
	console.log(`${'='.repeat(80)}\n`);
	console.log(`Total branches tested: ${totalBranches}`);
	console.log(`Total time: ${totalTime} minutes`);
	console.log(`Average time per branch: ${(totalTime / totalBranches).toFixed(1)} minutes\n`);
	console.log('Results breakdown:');
	console.log(`  ✓ NodeBB started successfully: ${successfulStarts}`);
	console.log(`  ⚠ Tests failed (NodeBB not tested): ${testFailures}`);
	console.log(`  ✗ NodeBB failed to start: ${startupFailures}`);
	console.log(`  ✗ Errors during testing: ${errors}\n`);
	console.log(`${'='.repeat(80)}`);
	console.log('DETAILED RESULTS');
	console.log(`${'='.repeat(80)}\n`);
	results.forEach((r) => {
		const status = r.nodebbStarted === 'Yes' ? '✓' : r.nodebbStarted === 'tests failed' ? '⚠' : '✗';
		console.log(`${status} ${r.branch}:`);
		console.log(`    Tests: ${r.testsPassed} passed, ${r.testsFailed} failed`);
		console.log(`    NodeBB: ${r.nodebbStarted}\n`);
	});
	console.log(`${'='.repeat(80)}\n`);
	console.log(`Results saved to: ${csvOutput}`);
}

// Run the script
main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
