import { useState } from "react";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { NIP05NameSearchDialog } from '@/components/NIP05NameSearchDialog';
import * as nip19 from "nostr-tools/nip19";

export function KeyDialog() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [keys, setKeys] = useState({ sk: null, pk: null });
    const [isSecretVisible, setIsSecretVisible] = useState(false);
    const [notification, setNotification] = useState(null); // Declare notification state

    const handleScroll = () => {
        const target = document.getElementById('get-nostr');
        if (target) {
            setIsDialogOpen(false);
            target.scrollIntoView({ behavior: 'smooth' });
        } else {
            console.error('Element with id "hero-section" not found.');
        }
    };

    const openDialog = () => {
        setNotification("Generating keys...");
        setTimeout(() => {
            const sk = generateSecretKey(); // `sk` is a Uint8Array
            const pk = getPublicKey(sk); // `pk` is a hex string
            let nsec = nip19.nsecEncode(sk);
            let npub = nip19.npubEncode(pk);
            setKeys({ nsec, npub });
            setIsDialogOpen(true);
            setNotification(null);
        }, 1000);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setIsSecretVisible(false);
    };

    const copyNsecToClipboard = () => {
        if (keys.nsec) {
            navigator.clipboard.writeText(keys.nsec);
            showNotification("Copied to clipboard.");
        }
    };

    const copyNpubToClipboard = () => {
        if (keys.nsec) {
            navigator.clipboard.writeText(keys.npub);
            showNotification("Copied to clipboard.");
        }
    };

    const downloadKey = () => {
        if (keys.nsec) {
            const blob = new Blob(["############ NOSTR KEYS ############\n\n", "Your public key (npub):\n", keys.npub, "\n\n", "Your private key (nsec). Keep it PRIVATE:\n", keys.nsec], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "nostr-keys.txt";
            link.click();
            showNotification("Keys downloaded.");
        }
    };

    const showNotification = (message) => {
        setNotification(message);
        setTimeout(() => setNotification(null), 3000); // Hide after 3 seconds
    };

    return (
        <div className="flex flex-col items-center justify-center">
            {/* Button */}
            <button
                type="button"
                className="rounded-full bg-sky-300 hover:bg-sky-200 px-10 py-5 text-lg md:text-2xl text-slate-900 font-bold"
                onClick={openDialog}
            >
                Create your nostr account
            </button>

            {/* Dialog Box */}
            {isDialogOpen && (
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
                    onClick={closeDialog} // Close the dialog when the overlay is clicked
                >
                    <div
                        className="dark:bg-slate-900 p-6 rounded-lg shadow-lg max-w-4xl w-full"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the dialog
                    >
                        <div className="relative">
                            <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-3xl md:text-5xl tracking-tight text-transparent">
                                Welcome to nostr!
                            </p>
                            <p className="mt-3 sm:text-2xl md:text-2xl tracking-tight text-slate-400">
                                Nostr uses cryptographic keys to keep users in control.
                            </p>

                            {/* Display Public Key */}
                            <div className="mt-4 flex flex-col items-start space-y-4">
                                <div className="relative group">
                                    <p className="pb-2 sm:text-2xl md:text-xl tracking-tight text-slate-400">
                                        This is your public key. You can share this.
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            className="bg-sky-300 font-bold text-slate-900 hover:bg-sky-200 rounded group relative px-2 py-1 text-xs"
                                            onClick={copyNpubToClipboard}
                                        >
                                            <span className="material-icons text-xs">content_copy</span>
                                            <span className="absolute left-0 top-full mt-1 hidden w-max text-sm text-white text-xs bg-gray-700 px-3 py-1 rounded group-hover:block">
                                                Copy to Clipboard
                                            </span>
                                        </button>
                                        <span id="npub" className="text-slate-400 bg-gray-800 px-2 py-1 rounded text-xs">
                                            {keys.npub}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Display Secret Key */}
                            <div className="mt-6 flex flex-col items-start space-y-4 z-10">
                                <div className="relative group">
                                    <p className="pb-2 sm:text-2xl md:text-xl tracking-tight text-slate-400">
                                        This is your private key. Keep it private.
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            className="bg-sky-300 font-bold text-slate-900 hover:bg-sky-200 rounded group relative px-2 py-1 text-xs"
                                            onClick={copyNsecToClipboard}
                                        >
                                            <span className="material-icons text-xs">content_copy</span>
                                            <span className="absolute left-0 top-full mt-1 hidden w-max text-sm text-white text-xs bg-gray-700 px-3 py-1 rounded group-hover:block">
                                                Copy to Clipboard
                                            </span>
                                        </button>
                                        <span className="text-slate-400 bg-gray-800 px-2 py-1 rounded text-xs">
                                            {isSecretVisible
                                                ? keys.nsec
                                                    ? keys.nsec
                                                    : "N/A"
                                                : "****************************************************************"}
                                        </span>
                                    </div>
                                </div>
                                <p className="pb-2 sm:text-2xl md:text-xl tracking-tight text-slate-400">
                                    Save these keys somewhere safe, they were created locally in your browser and will not be shown again!
                                </p>
                                <div className="flex flex-row items-center space-x-4">
                                    {/* Download Button */}
                                    <button
                                        type="button"
                                        className="bg-sky-300 text-slate-900 font-bold hover:bg-sky-200 px-3 py-2 rounded group relative"
                                        onClick={downloadKey}
                                    >
                                        Download keys
                                        <span className="absolute left-0 top-full mt-1 hidden w-max text-sm text-white bg-gray-700 px-3 py-1 rounded group-hover:block">
                                            Download Keys
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsSecretVisible(!isSecretVisible)}
                                        className="bg-sky-300 text-slate-900 font-bold hover:bg-sky-200 px-3 py-2 rounded group relative"
                                    >
                                        {isSecretVisible ? "Hide Private Key" : "Show Private Key"}
                                        <span className="absolute left-0 top-full mt-1 hidden w-max text-sm text-white bg-gray-700 px-3 py-1 rounded group-hover:block">
                                            Toggle Visibility
                                        </span>
                                    </button>


                                </div>
                            </div>

                            <div className="relative mt-10">
                                <p className="inline bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-2xl md:text-4xl tracking-tight text-transparent">
                                    I have saved my keys, what next?
                                </p>
                                <p className="mt-3 sm:text-2xl md:text-2xl tracking-tight text-slate-400">
                                    Get a pretty name for nostr (your-name@nostr.com) or skip and get an app.
                                </p>
                                <div className="relative z-10 flex flex-col md:flex-row pt-5 items-start md:items-center space-y-4 md:space-y-0">
                                    <div className="relative flex flex-col sm:w-1/4 lg:w-2/5 lg:max-w-[34vw]">
                                        <NIP05NameSearchDialog></NIP05NameSearchDialog>

                                    </div>
                                    <button
                                        type="button"
                                        button onClick={handleScroll}
                                        className="rounded-full text-sky-300 text-lg  md:text-2xl 
        hover:bg-transparent hover:text-sky-400 hover:border-sky-400 py-5 
        font-bold transition-colors duration-200 md:ml-4"
                                    >
                                        Skip and checkout nostr apps
                                    </button>

                                </div>

                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={closeDialog}
                                    className="absolute top-4 right-4 text-sky-300 text-lg md:text-2xl hover:bg-transparent hover:text-sky-400 hover:border-sky-400 flex items-center justify-center rounded-full font-bold transition-colors duration-200"
                                    title="Close"
                                >
                                    <span className="material-icons">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Notification */}
            {notification && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black text-white py-2 px-4 rounded shadow-md z-[101]">
                    {notification}
                </div>
            )}
        </div>
    );
}