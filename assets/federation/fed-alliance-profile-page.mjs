import {mountAllianceMemberPage} from './fed-alliance-member-page.mjs';
import {mountAllianceAccountControls} from './fed-alliance-account-controls.mjs';
// Closed by default. Only a reviewed source composition can enable these.
// Query strings, browser storage and page attributes cannot open the service.
const memberPage=mountAllianceMemberPage(document);
mountAllianceAccountControls(document,{memberPage});
