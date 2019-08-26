
// Breaks out of the content script context by injecting a specially
// constructed script tag and injecting it into the page.
// See: https://intoli.com/blog/sandbox-breakout/
const runInPageContext = (method, ...args) => {
  // The stringified method which will be parsed as a function object.
  const stringifiedMethod = method instanceof Function
    ? method.toString()
    : `() => { ${method} }`;

  // The stringified arguments for the method as JS code that will reconstruct the array.
  const stringifiedArgs = JSON.stringify(args);

  // The full content of the script tag.
  const scriptContent = `
    // Parse and run the method with its arguments.
    (${stringifiedMethod})(...${stringifiedArgs});

    // Remove the script element to cover our tracks.
    document.currentScript.parentElement
      .removeChild(document.currentScript);
  `;

  // Create a script tag and inject it into the document.
  const scriptElement = document.createElement('script');
  scriptElement.innerHTML = scriptContent;
  document.documentElement.prepend(scriptElement);
};


// Applies a random browser fingerprint within a page context.
// See: https://intoli.com/blog/not-possible-to-block-chrome-headless/
const applyBrowserFingerprintFromUserAgents = (browserFingerprint) => {
  // Pass the Webdriver Test.
  Object.defineProperty(navigator, 'webdriver', {
    get: () => {
      if (/firefox/i.test(browserFingerprint.userAgent)) {
        return false;
      }
      return undefined;
    },
  });

  // Pass the Chrome Test.
  // We can mock this in as much depth as we need for the test.
  window.chrome = {
    runtime: {},
    // etc.
  };

  // Pass the Permissions Test.
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = parameters => (
    parameters.name === 'notifications' ?
      Promise.resolve({ state: Notification.permission }) :
      originalQuery(parameters)
  );

  // Pass the Plugins Length Test.
  // Overwrite the `plugins` property to use a custom getter.
  Object.defineProperty(navigator, 'plugins', {
    // This just needs to have `length > 0` for the current test,
    // but we could mock the plugins too if necessary.
    get: () => Array(browserFingerprint.pluginsLength).fill(),
  });

  // Pass the Languages Test.
  Object.defineProperty(navigator, 'languages', {
    get: () => [browserFingerprint.language || 'en-US'],
  });

  // Attach the remaining navigator properties.
  const navigatorProperties = [
    'appName',
    'connection',
    'cpuClass',
    'language',
    'oscpu',
    'platform',
    'userAgent',
    'vendor',
  ];
  navigatorProperties
    .map(key => [key, browserFingerprint[key]])
    .filter(([, value]) => value !== undefined)
    .forEach(([key, value]) => {
      // Overwrite the `key` property to use a custom getter.
      Object.defineProperty(navigator, key, {
        get: () => value,
      });
    });
};


// A variation of the above which handles the more extensive format from tracking pixels.
const applyBrowserFingerprintFromTrackingPixels = (browserFingerprint) => {
  //
  // AudioContext
  //
  const AudioContext = (window.AudioContext || window.webkitAudioContext)

  //
  // AudioNode
  //
  const audioNodeProperties = [
    'channelCount',
    'channelCountMode',
    'channelInterpretation',
    'maxChannelCount',
    'numberOfInputs',
    'numberOfOutputs',
  ];
  audioNodeProperties.forEach((property) => {
    Object.defineProperty(AudioNode.prototype, property, { get: () => browserFingerprint[`audio_${property}`] });
  });

  const audioContextProperties = [
    'sampleRate',
    'state',
  ];
  audioContextProperties.forEach((property) => {
    Object.defineProperty(AudioContext.prototype, property, { get: () => browserFingerprint[`audio_${property}`] });
  });

  //
  // AnalyserNode
  //
  const analyserNodeProperties = [
    'fftSize',
    'frequencyBinCount',
    'maxDecibels',
    'minDecibels',
    'smoothingTimeConstant',
  ];
  analyserNodeProperties.forEach((property) => {
    Object.defineProperty(AnalyserNode.prototype, property, { get: () => browserFingerprint[`audio_${property}`] });
  });


  //
  // Navigator Properties
  //
  const navigatorProperties = [
    'activeVRDisplays',
    'appCodeName',
    'appName',
    'appVersion',
    'buildID',
    'cookieEnabled',
    'credentials',
    'doNotTrack',
    'getGamepads',
    'getVRDisplays',
    'hardwareConcurrency',
    'language',
    'languages',
    'maxTouchPoints',
    'mediaDevices',
    'onLine',
    'oscpu',
    'platform',
    'product',
    'productSub',
    'taintEnabled',
    'vendor',
    'vendorSub',
    'webdriver',
  ];
  navigatorProperties.forEach((property) => {
    // Attempt parsing the value as JSON, and then fall back to the actual value
    const rawValue = browserFingerprint[`navigator_${property}`];
    let value = rawValue === 'undefined' ? undefined : rawValue;
    try {
      // Treat null as undefined, this is how they're stored in the tracking pixel.
      value = value == null
        ? undefined
        : JSON.parse(rawValue);
    } catch (error) { /* Probably means that it is a string. */ }
    const descriptor = Object.getOwnPropertyDescriptor(window.navigator, property);
    if ((descriptor || {}).configurable !== false) {
      Object.defineProperty(window.navigator, property, { get: () => value });
    }
  });


  //
  // User Agent
  //
  Object.defineProperty(navigator, 'userAgent', {
    get: () => browserFingerprint.server_useragent,
  });


  //
  // WebGL
  //
  [window.WebGLRenderingContext, window.WebGL2RenderingContext]
    .filter(RenderingContext => RenderingContext != null)
    .forEach((RenderingContext) => {
      const originalRenderingContextGetParameter = RenderingContext.prototype.getParameter;
      RenderingContext.prototype.getParameter = function (parameter) {
        // RENDERER
        if (parameter === 0x1F01) {
          return browserFingerprint.webgl_renderer;
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 0x9246) {
          return browserFingerprint.webgl_unmaskedRenderer;
        }
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 0x9245) {
          return browserFingerprint.webgl_unmaskedVendor;
        }
        // SHADING_LANGUAGE_VENDOR
        if (parameter === 0x8B8C) {
          return browserFingerprint.webgl_shadingLanguageVersion;
        }
        // VENDOR
        if (parameter === 0x1F00) {
          return browserFingerprint.webgl_vendor;
        }
        // VERSION
        if (parameter === 0x1F02) {
          return browserFingerprint.webgl_version;
        }

        return originalRenderingContextGetParameter.apply(this, arguments);
      };
    });

  //
  // Screen Size
  //
  window.innerHeight = browserFingerprint.innerHeight;
  window.innerWidth = browserFingerprint.innerWidth;
  Object.defineProperty(window.screen, 'height', { get: () => browserFingerprint.screen_height });
  Object.defineProperty(window.screen, 'width', { get: () => browserFingerprint.screen_width });

  //
  // Plugins and Mimetypes
  //
  const constructMimeType = (properties) => {
    // Start with an arbitrary object.
    const mimeType = {};

    // Modify the prototype of the constructed object to match `MimeType`.
    Object.setPrototypeOf(mimeType, MimeType.prototype);

    // Override each of the properties on the object.
    ['description', 'enabledPlugin', 'suffixes', 'type'].forEach((propertyName) => {
      const defaultValue = propertyName === 'enabledPlugin' ? undefined : '';
      Object.defineProperty(mimeType, propertyName, {
        configurable: true,
        enumerable: true,
        get: () => properties[propertyName] || defaultValue,
      });
    });

    return mimeType;
  };

  const constructMimeTypeArray = (mimeTypes = []) => {
    const mimeTypeArray = {};

    // Modify the prototype of the constructed object to match `MimeTypeArray`.
    Object.setPrototypeOf(mimeTypeArray, MimeTypeArray.prototype);

    mimeTypes.forEach((mimeType, index) => {
      [index, mimeType.type].forEach((propertyName) => {
        Object.defineProperty(mimeTypeArray, propertyName, {
          configurable: true,
          enumerable: true,
          value: mimeType,
          writable: false,
        });
      });
    });

    Object.defineProperty(mimeTypeArray, 'length', {
      configurable: true,
      enumerable: true,
      get: () => mimeTypes.length,
    });

    Object.defineProperty(mimeTypeArray, 'namedItem', {
      configurable: true,
      enumerable: true,
      value: name => mimeTypeArray[name],
      writable: true,
    });

    Object.defineProperty(mimeTypeArray, 'item', {
      configurable: true,
      enumerable: true,
      value: index => mimeTypeArray[parseInt(index, 10) || 0],
      writable: true,
    });

    return mimeTypeArray;
  };

  const constructPlugin = (properties, mimeTypePropertiesArray = []) => {
    // Start with an arbitrary object.
    const plugin = {};

    // Modify the prototype of the constructed object to match `Plugin`.
    Object.setPrototypeOf(plugin, Plugin.prototype);

    // Override each of the properties on the object.
    ['description', 'filename', 'name', 'version'].forEach((propertyName) => {
      const defaultValue = propertyName === 'enabledPlugin' ? undefined : '';
      Object.defineProperty(plugin, propertyName, {
        configurable: true,
        enumerable: true,
        get: () => properties[propertyName],
      });
    });

    mimeTypePropertiesArray.forEach((mimeTypeProperties, index) => {
      const mimeType = constructMimeType(Object.assign(
        {},
        mimeTypeProperties,
        {
          enabledPlugin: plugin,
        },
      ));

      [index, mimeType.type].forEach((propertyName) => {
        Object.defineProperty(plugin, propertyName, {
          configurable: true,
          enumerable: true,
          value: mimeType,
          writable: false,
        });
      });
    });

    // Note that we're using the true number of MimeTypes rather than the recorded length.
    // This is because these seem to not be 100% consistent in the data.
    Object.defineProperty(plugin, 'length', {
      configurable: true,
      enumerable: true,
      get: () => mimeTypePropertiesArray.length,
    });

    Object.defineProperty(plugin, 'namedItem', {
      configurable: true,
      enumerable: true,
      value: name => plugin[name],
      writable: true,
    });

    Object.defineProperty(plugin, 'item', {
      configurable: true,
      enumerable: true,
      value: index => plugin[parseInt(index, 10) || 0],
      writable: true,
    });

    return plugin;
  };

  const constructPluginArray = (plugins = []) => {
    const pluginArray = {};

    // Modify the prototype of the constructed object to match `MimeTypeArray`.
    Object.setPrototypeOf(pluginArray, PluginArray.prototype);

    plugins.forEach((plugin, index) => {
      [index, plugin.name].forEach((propertyName) => {
        Object.defineProperty(pluginArray, propertyName, {
          configurable: true,
          enumerable: true,
          value: plugin,
          writable: false,
        });
      });
    });

    Object.defineProperty(pluginArray, 'length', {
      configurable: true,
      enumerable: true,
      get: () => plugins.length,
    });

    Object.defineProperty(pluginArray, 'item', {
      configurable: true,
      enumerable: true,
      value: index => pluginArray[parseInt(index, 10) || 0],
      writable: true,
    });

    Object.defineProperty(pluginArray, 'namedItem', {
      configurable: true,
      enumerable: true,
      value: name => pluginArray[name],
      writable: true,
    });

    Object.defineProperty(pluginArray, 'refresh', {
      configurable: true,
      enumerable: true,
      value: () => {},
      writable: true,
    });

    return pluginArray;
  };

  // Construct the actual mimetype/plugin instances.
  const mimeTypes = [];
  const plugins = [];
  JSON.parse(browserFingerprint.navigator_plugins || '[]').forEach((pluginProperties) => {
    // Find the corresponding mimetypes for this specific plugin.
    const mimeTypePropertiesArray = JSON.parse(browserFingerprint.navigator_mimeTypes || '[]')
      .filter(mimeTypeProperties => (
        (mimeTypeProperties.enabledPlugin || {}).filename === pluginProperties.filename
      ));
    // Construct the plugin and corresponding mimetypes.
    const plugin = constructPlugin(pluginProperties, mimeTypePropertiesArray);
    plugins.push(plugin);

    // Store each of the newly constructed mimetypes.
    Object.values(plugin).filter(mimeTypeCandidate => mimeTypeCandidate instanceof MimeType)
      .forEach((mimeType) => { mimeTypes.push(mimeType); });
  });

  // Override the mimetype/plugin arrays.
  const mimeTypeArray = constructMimeTypeArray(mimeTypes);
  Object.defineProperty(window.navigator, 'mimeTypes', { get: () => mimeTypeArray });
  const pluginArray = constructPluginArray(plugins);
  Object.defineProperty(window.navigator, 'plugins', { get: () => pluginArray });


  //
  // WebRTC
  //
  window.navigator.mediaDevices.enumerateDevices = () => Promise.resolve(
    (JSON.parse(browserFingerprint.webrtc_mediaDevices || '[]')).map((device) => {
      if (/input/.test(device.kind) && window.InputDeviceInfo) {
        Object.setPrototypeOf(device, InputDeviceInfo.prototype);
      } else if (!!window.MediaDeviceInfo) {
        Object.setPrototypeOf(device, MediaDeviceInfo.prototype);
      }
      return device;
    })
  );
  const { get: RTCIceCandidateCandidateGetter } = Object.getOwnPropertyDescriptor(RTCIceCandidate.prototype, 'candidate');
  Object.defineProperty(RTCIceCandidate.prototype, 'candidate', {
    get: function () {
      try {
        const originalCandidate = RTCIceCandidateCandidateGetter.apply(this);
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
        return originalCandidate.replace(ipRegex, browserFingerprint.webrtc_localIP);
      } catch (error) {
        return null;
      }
    },
  });

  //
  // Font Fingerprinting
  //
  const whitelistFonts = (whitelistedFonts) => {
    // We'll allow the base fonts, the whitelisted fonts, and any web fonts.
    const baseFonts = new Set(['cursive', 'fantasy', 'monospace', 'sans-serif', 'serif']);
    const lowercaseWhitelistedFonts = new Set((whitelistedFonts || []).map(font => font.toLowerCase()));
    const webFonts = new Set(
      Array.from(document.fonts.values())
        .map(fontFace => fontFace.family.toLowerCase())
    );

    // Merges a list of fonts into a font-family style declaration.
    const joinFontFamily = (fonts) => (
      fonts
        .map(font => font.includes(' ') ? `"${font}"` : font)
        .join(', ')
    );

    // Splits a font-family style declaration into a list of fonts.
    const splitFontFamily = (fontFamily) => (
      fontFamily
        .replace(/"|'/g, '')
        .split(',')
        .map(font => font.trim())
    );

    // Checks whether a font-family style declaration includes one of our whitelisted fonts.
    const includesWhitelistedFont = (fontFamily) => (
      splitFontFamily(fontFamily)
        .map(font => font.toLowerCase())
        .some(lowercaseFont => webFonts.has(lowercaseFont) || lowercaseWhitelistedFonts.has(lowercaseFont))
    );

    // Stop any non-whitelisted fonts from being assigned to elements. This prevents the
    // actually installed fonts from being detected.
    const removeNonwhitelistedFonts = (fontFamily) => (
      joinFontFamily(
        splitFontFamily(fontFamily)
          .filter(font => {
            const lowercaseFont = font.toLowerCase();
            return baseFonts.has(lowercaseFont)
              || webFonts.has(lowercaseFont)
              || lowercaseWhitelistedFonts.has(lowercaseFont);
          })
      )
    );
    const originalCSSStyleDeclarationSetProperty = CSSStyleDeclaration.prototype.setProperty;
    const modifiedCSSStyleDeclarationSetProperty = function (propertyName, value, priority) {
      const newValue = /font-family/i.test(propertyName)
        ? removeNonwhitelistedFonts(value)
        : value;
      originalCSSStyleDeclarationSetProperty.call(this, propertyName, newValue, priority);
    };
    Object.defineProperty(CSSStyleDeclaration.prototype, 'setProperty', {
      configurable: false,
      enumerable: true,
      value: modifiedCSSStyleDeclarationSetProperty,
      writable: false,
    });

    // Trigger the modified `setProperty()` method when assigning values to `element.style.fontFamily`.
    ['font-family', 'fontFamily'].forEach((propertyName) => {
      Object.defineProperty(CSSStyleDeclaration.prototype, propertyName, {
        configurable: false,
        enumerable: true,
        get: function () { return this.getPropertyValue('font-family'); },
        set: function (value) { return this.setProperty('font-family', value); },
      });
    });

    // Trigger the modified `setProperty()` method for the font family of any HTML that's inserted
    // using either `innerHTML` or `outerHTML`.
    const recursivelyModifyFontFamily = (element) => {
      // Trigger the modified `setProperty()` method which will strip blacklisted fonts.
      if (element && element.style && element.style.fontFamily) {
        const priority = element.style.getPropertyPriority('font-family');
        element.style.setProperty('font-family', element.style.fontFamily, priority);
      }
      // Recursively apply the method to all child nodes.
      if (element && element.childNodes) {
        element.childNodes.forEach(recursivelyModifyFontFamily);
      }
    };
    ['innerHTML', 'outerHTML'].forEach((propertyName) => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, propertyName);
      Object.defineProperty(Element.prototype, propertyName, Object.assign(
        {},
        propertyDescriptor,
        {
          set: function (value) {
            propertyDescriptor.set.call(this, value);
            recursivelyModifyFontFamily(this);
          },
        },
      ));
    });

    // Lie about the size of elements that use whitelisted fonts to make it seem like they're installed.
    // This creates the illusion that the fonts are being rendered differently than the base fonts.
    ['clientHeight', 'clientWidth', 'offsetHeight', 'offsetWidth', 'scrollHeight', 'scrollWidth'].forEach((propertyName) => {
      const prototype = propertyName.startsWith('offset') ? HTMLElement.prototype : Element.prototype;
      const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (!propertyDescriptor) {
        return;
      }
      Object.defineProperty(prototype, propertyName, Object.assign(
        {},
        propertyDescriptor,
        {
          get: function () {
            const { fontFamily } = window.getComputedStyle(this);
            const dimension = propertyDescriptor.get.apply(this);
            const extraSize = includesWhitelistedFont(fontFamily) ? 1 : 0;
            return dimension + extraSize;
          },
        },
      ));
    });
  };
  whitelistFonts(
  browserFingerprint.fonts instanceof Array
    ? browserFingerprint.fonts
    : JSON.parse(browserFingerprint.fonts || '[]')
  );
};


// Parse the stringified browser fingerprint.
// This value is filled in from Python as a template variable.
const browserFingerprint = JSON.parse("{\"server_useragent\": \"Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36\", \"server_useragent_info\": \"Chrome 74.0 Blink (browser)\", \"server_useragent_os\": \"Windows 7 x64\", \"server_useragent_device\": \"desktop\", \"server_useragent_brand\": \"\", \"server_useragent_model\": \"\", \"server_ip\": \"162.140.252.10\", \"server_country\": \"United States\", \"server_city\": \"Ft. Washington\", \"server_region\": \"Maryland\", \"server_isp\": \"U.S. Government Printing Office\", \"server_asn\": \"AS3705\", \"server_lat\": 38.7592, \"server_long\": -76.9858, \"javascript_enabled\": \"true\", \"screen_width\": 2048, \"screen_height\": 864, \"innerWidth\": 1010, \"innerHeight\": 703, \"navigator_userAgent\": \"Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36\", \"navigator_appVersion\": \"5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like\", \"navigator_appName\": \"Netscape\", \"navigator_appCodeName\": \"Mozilla\", \"navigator_product\": \"Gecko\", \"navigator_productSub\": \"20030107\", \"navigator_vendor\": \"Google Inc.\", \"navigator_vendorSub\": null, \"navigator_buildID\": null, \"navigator_platform\": \"Win32\", \"navigator_oscpu\": null, \"navigator_hardwareConcurrency\": 4, \"navigator_language\": \"en-US\", \"navigator_languages\": \"[\\\"en-US\\\",\\\"en\\\"]\", \"navigator_onLine\": \"true\", \"navigator_doNotTrack\": null, \"navigator_cookieEnabled\": \"1\", \"navigator_maxTouchPoints\": 0, \"navigator_activeVRDisplays\": null, \"battery_charging\": \"true\", \"battery_chargingTime\": \"0\", \"battery_dischargingTime\": null, \"battery_level\": 1.0, \"audio_state\": \"suspended\", \"audio_sampleRate\": 48000, \"audio_maxChannelCount\": 2, \"audio_numberOfInputs\": 1, \"audio_numberOfOutputs\": 0, \"audio_channelCount\": 2, \"audio_channelCountMode\": \"explicit\", \"audio_channelInterpretation\": \"speakers\", \"audio_fftSize\": 2048, \"audio_frequencyBinCount\": 1024, \"audio_minDecibels\": -100, \"audio_maxDecibels\": -30, \"audio_smoothingTimeConstant\": 0.8, \"permission_geolocation\": \"denied\", \"permission_notifications\": \"prompt\", \"permission_midi\": \"granted\", \"permission_midiSysEx\": \"prompt\", \"permission_push\": \"prompt\", \"navigator_javaEnabled\": \"false\", \"navigator_getGamepads\": \"[]\", \"navigator_getVRDisplays\": \"[]\", \"navigator_taintEnabled\": null, \"navigator_mimeTypes\": \"[{\\\"description\\\":\\\"\\\",\\\"suffixes\\\":\\\"pdf\\\",\\\"type\\\":\\\"application\\\\/pdf\\\",\\\"enabledPlugin\\\":{\\\"description\\\":\\\"\\\",\\\"filename\\\":\\\"mhjfbmdgcfjbbpaeojofohoefgiehjai\\\",\\\"length\\\":1,\\\"name\\\":\\\"Chrome PDF Viewer\\\"}},{\\\"description\\\":\\\"Portable Document Format\\\",\\\"suffixes\\\":\\\"pdf\\\",\\\"type\\\":\\\"application\\\\/x-google-chrome-pdf\\\",\\\"enabledPlugin\\\":{\\\"description\\\":\\\"Portable Document Format\\\",\\\"filename\\\":\\\"internal-pdf-viewer\\\",\\\"length\\\":1,\\\"name\\\":\\\"Chrome PDF Plugin\\\"}},{\\\"description\\\":\\\"Native Client Executable\\\",\\\"suffixes\\\":\\\"\\\",\\\"type\\\":\\\"application\\\\/x-nacl\\\",\\\"enabledPlugin\\\":{\\\"description\\\":\\\"\\\",\\\"filename\\\":\\\"internal-nacl-plugin\\\",\\\"length\\\":2,\\\"name\\\":\\\"Native Client\\\"}},{\\\"description\\\":\\\"Portable Native Client Executable\\\",\\\"suffixes\\\":\\\"\\\",\\\"type\\\":\\\"application\\\\/x-pnacl\\\",\\\"enabledPlugin\\\":{\\\"description\\\":\\\"\\\",\\\"filename\\\":\\\"internal-nacl-plugin\\\",\\\"length\\\":2,\\\"name\\\":\\\"Native Client\\\"}}]\", \"navigator_plugins\": \"[{\\\"description\\\":\\\"Portable Document Format\\\",\\\"filename\\\":\\\"internal-pdf-viewer\\\",\\\"length\\\":1,\\\"name\\\":\\\"Chrome PDF Plugin\\\",\\\"mimeTypes\\\":[{\\\"description\\\":\\\"Portable Document Format\\\",\\\"suffixes\\\":\\\"pdf\\\",\\\"type\\\":\\\"application\\\\/x-google-chrome-pdf\\\"}]},{\\\"description\\\":\\\"\\\",\\\"filename\\\":\\\"mhjfbmdgcfjbbpaeojofohoefgiehjai\\\",\\\"length\\\":1,\\\"name\\\":\\\"Chrome PDF Viewer\\\",\\\"mimeTypes\\\":[{\\\"description\\\":\\\"\\\",\\\"suffixes\\\":\\\"pdf\\\",\\\"type\\\":\\\"application\\\\/pdf\\\"}]},{\\\"description\\\":\\\"\\\",\\\"filename\\\":\\\"internal-nacl-plugin\\\",\\\"length\\\":2,\\\"name\\\":\\\"Native Client\\\",\\\"mimeTypes\\\":[{\\\"description\\\":\\\"Native Client Executable\\\",\\\"suffixes\\\":\\\"\\\",\\\"type\\\":\\\"application\\\\/x-nacl\\\"},{\\\"description\\\":\\\"Portable Native Client Executable\\\",\\\"suffixes\\\":\\\"\\\",\\\"type\\\":\\\"application\\\\/x-pnacl\\\"}]}]\", \"navigator_mediaDevices\": \"[]\", \"navigator_credentials\": null, \"navigator_webdriver\": null, \"navigator_storage_enabled\": \"true\", \"navigator_storage_estimate\": null, \"navigator_storage_persist\": null, \"navigator_storage_persisted\": null, \"geolocation_latitude\": null, \"geolocation_longitude\": null, \"geolocation_accuracy\": null, \"geolocation_cacheAge\": null, \"webgl_webGLSupport\": \"true\", \"webgl_webGL2Support\": \"true\", \"webgl_supportedContextNames\": \"[\\\"webgl2\\\",\\\"webgl\\\",\\\"experimental-webgl\\\"]\", \"webgl_version\": \"WebGL 2.0 (OpenGL ES 3.0 Chromium)\", \"webgl_shadingLanguageVersion\": \"WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)\", \"webgl_vendor\": \"WebKit\", \"webgl_renderer\": \"WebKit WebGL\", \"webgl_antialiasing\": \"true\", \"webgl_ANGLE\": \"false\", \"webgl_majorPerformanceCaveat\": \"false\", \"webgl_unmaskedVendor\": \"Google Inc.\", \"webgl_unmaskedRenderer\": \"ANGLE (Intel(R) HD Graphics 5500 Direct3D11 vs_5_0 ps_5_0)\", \"webrtc_RTCPeerConnection\": \"true\", \"webrtc_RTCDataChannel\": \"true\", \"webrtc_ORTC\": \"false\", \"webrtc_deviceEnumeration\": \"true\", \"webrtc_hasMicrophone\": \"true\", \"webrtc_hasCamera\": \"true\", \"webrtc_mediaDevices\": \"[{\\\"deviceId\\\":\\\"default\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audioinput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"communications\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audioinput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"e68d933031fcc5179adb0ca8bd143bcd9bbffc07edd50503e4abda7823ea69b3\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audioinput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"23a82d635edad2abbf626ba0d0ad4e725553dced5cdd0732743c700e51f2a525\\\",\\\"groupId\\\":\\\"720da4dede6c490a2f15baf6cf721259b05ab7be23f500fb90a430126874084a\\\",\\\"kind\\\":\\\"videoinput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"default\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audiooutput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"communications\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audiooutput\\\",\\\"label\\\":null},{\\\"deviceId\\\":\\\"ed6ccc0aab0ab1bd4c2457c685a49c549a55f09eeeb345ed44933ec6b6fb2ee2\\\",\\\"groupId\\\":\\\"1bd5c3829aa53dffa5db75a9fc4b3352bd9a902b1a5eb3884f6c05ea4181b1ec\\\",\\\"kind\\\":\\\"audiooutput\\\",\\\"label\\\":null}]\", \"webrtc_localIP\": \"172.20.253.223\", \"canvas_supported\": \"true\", \"canvas_textAPI\": \"true\", \"canvas_toDataURL\": \"true\", \"gyroscope_supported\": null, \"gyroscope_isMoving\": null, \"gyroscope_x\": null, \"gyroscope_y\": null, \"gyroscope_z\": null, \"gyroscope_xWithGravity\": null, \"gyroscope_yWithGravity\": null, \"gyroscope_zWithGravity\": null, \"gyroscope_rotationAlpha\": null, \"gyroscope_rotationBeta\": null, \"gyroscope_rotationGamma\": null, \"gyroscope_interval\": null, \"connection\": \"{\\\"effectiveType\\\":\\\"4g\\\",\\\"rtt\\\":100,\\\"downlink\\\":10,\\\"saveData\\\":false}\", \"connection_type\": null, \"connection_effectiveType\": \"4g\", \"connection_downlink\": 10.0, \"connection_downlinkMax\": null, \"connection_rtt\": 100, \"connection_saveData\": \"false\", \"fonts\": \"[\\\"Arial\\\",\\\"Arial Black\\\",\\\"Arial Narrow\\\",\\\"Arial Unicode MS\\\",\\\"Book Antiqua\\\",\\\"Bookman Old Style\\\",\\\"Calibri\\\",\\\"Cambria\\\",\\\"Cambria Math\\\",\\\"Century\\\",\\\"Century Gothic\\\",\\\"Century Schoolbook\\\",\\\"Comic Sans MS\\\",\\\"Consolas\\\",\\\"Courier\\\",\\\"Courier New\\\",\\\"Georgia\\\",\\\"Helvetica\\\",\\\"Impact\\\",\\\"Lucida Bright\\\",\\\"Lucida Calligraphy\\\",\\\"Lucida Console\\\",\\\"Lucida Fax\\\",\\\"Lucida Handwriting\\\",\\\"Lucida Sans\\\",\\\"Lucida Sans Typewriter\\\",\\\"Lucida Sans Unicode\\\",\\\"Microsoft Sans Serif\\\",\\\"Monotype Corsiva\\\",\\\"MS Gothic\\\",\\\"MS PGothic\\\",\\\"MS Reference Sans Serif\\\",\\\"MS Sans Serif\\\",\\\"MS Serif\\\",\\\"Palatino Linotype\\\",\\\"Segoe Print\\\",\\\"Segoe Script\\\",\\\"Segoe UI\\\",\\\"Segoe UI Light\\\",\\\"Segoe UI Semibold\\\",\\\"Segoe UI Symbol\\\",\\\"Tahoma\\\",\\\"Times\\\",\\\"Times New Roman\\\",\\\"Trebuchet MS\\\",\\\"Verdana\\\",\\\"Wingdings\\\",\\\"Wingdings 2\\\",\\\"Wingdings 3\\\",\\\"Agency FB\\\",\\\"Aharoni\\\",\\\"Algerian\\\",\\\"Andalus\\\",\\\"Angsana New\\\",\\\"AngsanaUPC\\\",\\\"Aparajita\\\",\\\"Arabic Typesetting\\\",\\\"Baskerville Old Face\\\",\\\"Batang\\\",\\\"BatangChe\\\",\\\"Bauhaus 93\\\",\\\"Bell MT\\\",\\\"Berlin Sans FB\\\",\\\"Bernard MT Condensed\\\",\\\"Blackadder ITC\\\",\\\"Bodoni MT\\\",\\\"Bodoni MT Black\\\",\\\"Bodoni MT Condensed\\\",\\\"Bookshelf Symbol 7\\\",\\\"Bradley Hand ITC\\\",\\\"Broadway\\\",\\\"Browallia New\\\",\\\"BrowalliaUPC\\\",\\\"Brush Script MT\\\",\\\"Californian FB\\\",\\\"Calisto MT\\\",\\\"Candara\\\",\\\"Castellar\\\",\\\"Centaur\\\",\\\"Chiller\\\",\\\"Colonna MT\\\",\\\"Constantia\\\",\\\"Cooper Black\\\",\\\"Copperplate Gothic\\\",\\\"Copperplate Gothic Light\\\",\\\"Corbel\\\",\\\"Cordia New\\\",\\\"CordiaUPC\\\",\\\"Curlz MT\\\",\\\"DaunPenh\\\",\\\"David\\\",\\\"DFKai-SB\\\",\\\"DilleniaUPC\\\",\\\"DokChampa\\\",\\\"Dotum\\\",\\\"DotumChe\\\",\\\"Ebrima\\\",\\\"Edwardian Script ITC\\\",\\\"Elephant\\\",\\\"Engravers MT\\\",\\\"EucrosiaUPC\\\",\\\"Euphemia\\\",\\\"FangSong\\\",\\\"Felix Titling\\\",\\\"Footlight MT Light\\\",\\\"Forte\\\",\\\"FrankRuehl\\\",\\\"FreesiaUPC\\\",\\\"Freestyle Script\\\",\\\"French Script MT\\\",\\\"Gabriola\\\",\\\"Gautami\\\",\\\"Gigi\\\",\\\"Gill Sans MT\\\",\\\"Gill Sans MT Condensed\\\",\\\"Gisha\\\",\\\"Goudy Old Style\\\",\\\"Goudy Stout\\\",\\\"Gulim\\\",\\\"GulimChe\\\",\\\"Gungsuh\\\",\\\"GungsuhChe\\\",\\\"Haettenschweiler\\\",\\\"Harrington\\\",\\\"High Tower Text\\\",\\\"Imprint MT Shadow\\\",\\\"Informal Roman\\\",\\\"IrisUPC\\\",\\\"Iskoola Pota\\\",\\\"JasmineUPC\\\",\\\"Jokerman\\\",\\\"Juice ITC\\\",\\\"KaiTi\\\",\\\"Kalinga\\\",\\\"Kartika\\\",\\\"Khmer UI\\\",\\\"KodchiangUPC\\\",\\\"Kokila\\\",\\\"Kristen ITC\\\",\\\"Kunstler Script\\\",\\\"Lao UI\\\",\\\"Latha\\\",\\\"Leelawadee\\\",\\\"Levenim MT\\\",\\\"LilyUPC\\\",\\\"Magneto\\\",\\\"Maiandra GD\\\",\\\"Malgun Gothic\\\",\\\"Mangal\\\",\\\"Marlett\\\",\\\"Matura MT Script Capitals\\\",\\\"Meiryo\\\",\\\"Meiryo UI\\\",\\\"Microsoft Himalaya\\\",\\\"Microsoft JhengHei\\\",\\\"Microsoft New Tai Lue\\\",\\\"Microsoft PhagsPa\\\",\\\"Microsoft Tai Le\\\",\\\"Microsoft Uighur\\\",\\\"Microsoft YaHei\\\",\\\"Microsoft Yi Baiti\\\",\\\"MingLiU\\\",\\\"MingLiU_HKSCS\\\",\\\"MingLiU_HKSCS-ExtB\\\",\\\"MingLiU-ExtB\\\",\\\"Miriam\\\",\\\"Miriam Fixed\\\",\\\"Mistral\\\",\\\"Modern No. 20\\\",\\\"Mongolian Baiti\\\",\\\"MoolBoran\\\",\\\"MS Mincho\\\",\\\"MS PMincho\\\",\\\"MS Reference Specialty\\\",\\\"MS UI Gothic\\\",\\\"MV Boli\\\",\\\"Narkisim\\\",\\\"Niagara Engraved\\\",\\\"Niagara Solid\\\",\\\"NSimSun\\\",\\\"Nyala\\\",\\\"Old English Text MT\\\",\\\"Onyx\\\",\\\"Palace Script MT\\\",\\\"Papyrus\\\",\\\"Parchment\\\",\\\"Perpetua\\\",\\\"Perpetua Titling MT\\\",\\\"Plantagenet Cherokee\\\",\\\"Playbill\\\",\\\"PMingLiU\\\",\\\"PMingLiU-ExtB\\\",\\\"Poor Richard\\\",\\\"Pristina\\\",\\\"Raavi\\\",\\\"Ravie\\\",\\\"Rockwell\\\",\\\"Rockwell Condensed\\\",\\\"Rod\\\",\\\"Sakkal Majalla\\\",\\\"Shonar Bangla\\\",\\\"Showcard Gothic\\\",\\\"Shruti\\\",\\\"SimHei\\\",\\\"Simplified Arabic\\\",\\\"Simplified Arabic Fixed\\\",\\\"SimSun\\\",\\\"SimSun-ExtB\\\",\\\"Snap ITC\\\",\\\"Stencil\\\",\\\"Sylfaen\\\",\\\"Tempus Sans ITC\\\",\\\"Traditional Arabic\\\",\\\"Tunga\\\",\\\"Tw Cen MT\\\",\\\"Tw Cen MT Condensed\\\",\\\"Utsaah\\\",\\\"Vani\\\",\\\"Vijaya\\\",\\\"Viner Hand ITC\\\",\\\"Vivaldi\\\",\\\"Vladimir Script\\\",\\\"Vrinda\\\",\\\"Wide Latin\\\"]\"}");

// Apply the overrides in the context of the page.
if (/user_agents/i.test(browserFingerprint.fingerprintType)) {
  runInPageContext(applyBrowserFingerprintFromUserAgents, browserFingerprint);
} else {
  runInPageContext(applyBrowserFingerprintFromTrackingPixels, browserFingerprint);
}
