import test from 'node:test';
import assert from 'node:assert/strict';
import { assessEntryLevelFit, requiredYears } from '../server/discovery/entryLevelFit.js';

const fitOf = (title, description = '') => assessEntryLevelFit({ title, description }).fit;
const reasonsOf = (title, description = '') => assessEntryLevelFit({ title, description }).reasons.map(reason => reason.text);

test('reads required years from common phrasings, taking the lowest requirement', () => {
  assert.equal(requiredYears('Requires 2+ years of experience in help desk support.'), 2);
  assert.equal(requiredYears('3-5 yrs experience with Active Directory'), 3);
  assert.equal(requiredYears("Minimum of two years' help desk experience required."), 2);
  assert.equal(requiredYears('At least 4 years in IT support experience; 6 years of experience preferred.'), 4);
  assert.equal(requiredYears('0-1 years experience. Will train.'), 0);
  assert.equal(requiredYears('Five or more years'), null);
  assert.equal(requiredYears('Great benefits. Apply today.'), null);
  assert.equal(requiredYears(null), null);
});

test('ignores employer boasts, implausible numbers, and years inside other numbers', () => {
  assert.equal(requiredYears('Our team has 10 years of experience serving clients. 1+ years experience needed.'), 1);
  assert.equal(requiredYears('We have 12 years experience in managed services.'), null);
  assert.equal(requiredYears('Founded with 25 years of experience in the region.'), null);
  assert.equal(requiredYears('Since 2012 years of growth have followed; no experience needed.'), null);
  // "we" alone is not a boast: this is a real requirement.
  assert.equal(requiredYears('We require 2+ years of experience.'), 2);
});

test('senior titles and high experience requirements read as senior', () => {
  assert.equal(fitOf('Senior Systems Administrator'), 'senior');
  assert.equal(fitOf('Sr. Network Engineer'), 'senior');
  assert.equal(fitOf('IT Support Lead'), 'senior');
  assert.equal(fitOf('IT Manager'), 'senior');
  assert.equal(fitOf('Cloud Architect'), 'senior');
  assert.equal(fitOf('Systems Engineer III'), 'senior');
  assert.equal(fitOf('Help Desk Technician', '5+ years of experience required.'), 'senior');
  // The years requirement outweighs an entry-sounding title.
  assert.equal(fitOf('Junior Systems Engineer', 'Minimum 6 years of experience with VMware.'), 'senior');
});

test('mid-level signals read as a stretch', () => {
  assert.equal(fitOf('Help Desk Analyst II'), 'stretch');
  assert.equal(fitOf('Desktop Support (Tier 2)'), 'stretch');
  assert.equal(fitOf('IT Specialist', '3+ years of experience supporting end users.'), 'stretch');
  assert.equal(fitOf('Network Technician', 'Must hold an active Secret clearance.'), 'stretch');
  assert.equal(fitOf('Systems Administrator', 'TS/SCI required.'), 'stretch');
});

test('entry signals in the title or description read as entry', () => {
  assert.equal(fitOf('Junior IT Support Technician'), 'entry');
  assert.equal(fitOf('Help Desk Analyst I'), 'entry');
  assert.equal(fitOf('Service Desk Technician - Level 1'), 'entry');
  assert.equal(fitOf('Associate Systems Engineer'), 'entry');
  assert.equal(fitOf('IT Technician', 'This is an entry-level role. Paid training provided.'), 'entry');
  assert.equal(fitOf('Desktop Support', '1-2 years of experience preferred.'), 'entry');
});

test('returns unknown when nothing indicates a level', () => {
  assert.equal(fitOf('IT Support Technician', 'Support our users on site in Auburn.'), 'unknown');
  assert.equal(fitOf('Network Technician', 'Ability to obtain a security clearance.'), 'unknown');
  assert.equal(fitOf(''), 'unknown');
  assert.deepEqual(assessEntryLevelFit(), { fit: 'unknown', requiredYears: null, reasons: [] });
});

test('does not mistake ordinary words or product numbers for level signals', () => {
  assert.equal(fitOf('Windows 11 Support Technician'), 'unknown');
  assert.equal(fitOf('Office 365 Administrator - Remote'), 'unknown');
  assert.equal(fitOf('IT Asset Management Technician'), 'unknown');
  assert.equal(fitOf('Internal IT Support'), 'unknown');
  assert.equal(fitOf('Help Desk / IT'), 'unknown');
});

test('explains the verdict with reasons ordered by weight', () => {
  const result = assessEntryLevelFit({ title: 'Senior Help Desk Analyst I', description: 'Entry level friendly team.' });
  assert.equal(result.fit, 'senior');
  assert.deepEqual(result.reasons.map(reason => reason.tone), ['negative', 'positive', 'positive']);
  assert.deepEqual(reasonsOf('Help Desk Analyst', '2+ years of experience. Will train.'), ['Asks 2+ yrs', 'Training provided']);
  assert.deepEqual(reasonsOf('Help Desk Analyst', '0-1 years experience'), ['No years required']);
});
