#!/usr/bin/env node

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CSV_OUTPUT = 'branch-test-results.csv';
const NODEBB_STARTUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const NODEBB_CHECK_INTERVAL = 5000; // Check every 5 seconds

// Get the branch name from command line args
const targetBranch = process.argv[2];

if (!targetBranch) {
	console.error('Usage: node test-single-branch.js <branch-name>');
	process.exit(1);
}

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
async function testBranch(branchName) {
	console.log('\n========================================');
	console.log(`Testing branch: ${branchName}`);
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
function writeCSV(results) {
	const headers = 'Branch Name,Tests Passed,Tests Failed,NodeBB Started Successfully\n';
	const rows = results.map(r =>
		`${r.branch},${r.testsPassed},${r.testsFailed},${r.nodebbStarted}`).join('\n');

	fs.writeFileSync(CSV_OUTPUT, headers + rows);
	console.log(`\nResults written to ${CSV_OUTPUT}`);
}

// Main function
async function main() {
	console.log('Branch Testing Script (Single Branch Test)');
	console.log('==========================================\n');

	// Save current branch
	const originalBranch = getCurrentBranch();
	console.log(`Current branch: ${originalBranch}`);
	console.log(`Target branch: ${targetBranch}\n`);

	// Test the branch
	const result = await testBranch(targetBranch);

	// Restore original branch
	console.log(`\nRestoring original branch: ${originalBranch}`);
	try {
		exec(`git checkout ${originalBranch}`, { silent: false });
	} catch (error) {
		console.log(`Warning: Could not restore original branch: ${error.message}`);
	}

	// Write CSV
	writeCSV([result]);

	// Print summary
	console.log('\nSummary:');
	console.log('--------');
	console.log(`${result.branch}: ${result.testsPassed} passed, ${result.testsFailed} failed, NodeBB: ${result.nodebbStarted}`);
}

// Run the script
main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
