const fs = require('node:fs');
const path = require('node:path');

patchAndroidManifest();
patchIosInfoPlist();

function patchAndroidManifest() {
  const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) return;

  const source = fs.readFileSync(manifestPath, 'utf8');
  let next = source;

  if (!next.includes('android.permission.POST_NOTIFICATIONS')) {
    const withNotificationPermission = next.replace(
      /(<manifest\b[^>]*>\s*)/,
      '$1\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
    );
    if (withNotificationPermission === next) throw new Error(`Could not patch notification permission in ${manifestPath}`);
    next = withNotificationPermission;
  }

  if (!next.includes('android:scheme="nostr"')) {
    const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />

                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />

                <data android:scheme="nostr" />
            </intent-filter>
`;

    const activityPattern = /(<activity\b[^>]*android:name="[^"]*MainActivity"[\s\S]*?)(\n\s*<\/activity>)/;
    const withIntentFilter = next.replace(activityPattern, `$1${intentFilter}$2`);
    if (withIntentFilter === next) throw new Error(`Could not find MainActivity in ${manifestPath}`);
    next = withIntentFilter;
  }

  if (next === source) return;
  fs.writeFileSync(manifestPath, next);
  console.log(`Patched ${manifestPath} for native permissions and nostr: links`);
}

function patchIosInfoPlist() {
  const plistPath = path.join('ios', 'App', 'App', 'Info.plist');
  if (!fs.existsSync(plistPath)) return;

  const source = fs.readFileSync(plistPath, 'utf8');
  if (source.includes('<string>nostr</string>')) return;

  const urlTypes = `
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLName</key>
			<string>com.nostr.social</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>nostr</string>
			</array>
		</dict>
	</array>
`;

  const next = source.replace(/\n<\/dict>\s*\n<\/plist>\s*$/, `${urlTypes}</dict>\n</plist>\n`);
  if (next === source) throw new Error(`Could not patch ${plistPath}`);

  fs.writeFileSync(plistPath, next);
  console.log(`Patched ${plistPath} for nostr: links`);
}
