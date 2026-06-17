const fs = require('node:fs');
const path = require('node:path');

patchAndroidManifest();
patchIosInfoPlist();

function patchAndroidManifest() {
  const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) return;

  const source = fs.readFileSync(manifestPath, 'utf8');
  if (source.includes('android:scheme="nostr"')) return;

  const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />

                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />

                <data android:scheme="nostr" />
            </intent-filter>
`;

  const activityPattern = /(<activity\b[^>]*android:name="[^"]*MainActivity"[\s\S]*?)(\n\s*<\/activity>)/;
  const next = source.replace(activityPattern, `$1${intentFilter}$2`);
  if (next === source) throw new Error(`Could not find MainActivity in ${manifestPath}`);

  fs.writeFileSync(manifestPath, next);
  console.log(`Patched ${manifestPath} for nostr: links`);
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
