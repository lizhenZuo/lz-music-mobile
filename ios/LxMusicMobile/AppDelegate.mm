#import "AppDelegate.h"
#import <ReactNativeNavigation/ReactNativeNavigation.h>

#import <React/RCTBundleURLProvider.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTDevSettings.h>
#import <React/RCTEventEmitter.h>
#import <CommonCrypto/CommonCryptor.h>
#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>
#import <UserNotifications/UserNotifications.h>
#import <UIKit/UIKit.h>
#include <ifaddrs.h>
#include <arpa/inet.h>

@interface UtilsModule : RCTEventEmitter <RCTBridgeModule>
@end

@implementation UtilsModule {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"screen-size-changed" ];
}

- (void)startObserving {
  _hasListeners = YES;
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(handleSizeChange) name:UIDeviceOrientationDidChangeNotification object:nil];
}

- (void)stopObserving {
  _hasListeners = NO;
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleSizeChange {
  if (!_hasListeners) return;
  CGSize size = UIScreen.mainScreen.bounds.size;
  [self sendEventWithName:@"screen-size-changed" body:@{ @"width": @(size.width), @"height": @(size.height) }];
}

RCT_EXPORT_METHOD(exitApp) {}

RCT_REMAP_METHOD(getSupportedAbis,
                 getSupportedAbisWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@[ @"arm64" ]);
}

RCT_REMAP_METHOD(installApk,
                 installApkWithPath:(NSString *)filePath
                 fileProviderAuthority:(NSString *)fileProviderAuthority
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter2:(RCTPromiseRejectBlock)reject) {
  reject(@"unsupported", @"installApk is unsupported on iOS", nil);
}

RCT_EXPORT_METHOD(screenkeepAwake) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = YES;
  });
}

RCT_EXPORT_METHOD(screenUnkeepAwake) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication sharedApplication].idleTimerDisabled = NO;
  });
}

RCT_REMAP_METHOD(getWIFIIPV4Address,
                 getWIFIIPV4AddressWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter3:(RCTPromiseRejectBlock)reject) {
  struct ifaddrs *interfaces = NULL;
  struct ifaddrs *tempAddr = NULL;
  NSString *address = @"127.0.0.1";
  if (getifaddrs(&interfaces) == 0) {
    tempAddr = interfaces;
    while (tempAddr != NULL) {
      if (tempAddr->ifa_addr && tempAddr->ifa_addr->sa_family == AF_INET) {
        NSString *name = [NSString stringWithUTF8String:tempAddr->ifa_name];
        if ([name isEqualToString:@"en0"]) {
          address = [NSString stringWithUTF8String:inet_ntoa(((struct sockaddr_in *)tempAddr->ifa_addr)->sin_addr)];
          break;
        }
      }
      tempAddr = tempAddr->ifa_next;
    }
  }
  freeifaddrs(interfaces);
  resolve(address);
}

RCT_REMAP_METHOD(getDeviceName,
                 getDeviceNameWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter4:(RCTPromiseRejectBlock)reject) {
  resolve(UIDevice.currentDevice.name ?: @"iPhone");
}

RCT_REMAP_METHOD(isNotificationsEnabled,
                 isNotificationsEnabledWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter5:(RCTPromiseRejectBlock)reject) {
  [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
    resolve(@(settings.authorizationStatus == UNAuthorizationStatusAuthorized || settings.authorizationStatus == UNAuthorizationStatusProvisional || settings.authorizationStatus == UNAuthorizationStatusEphemeral));
  }];
}

RCT_REMAP_METHOD(openNotificationPermissionActivity,
                 openNotificationPermissionActivityWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter6:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSURL *url = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
    BOOL result = [[UIApplication sharedApplication] canOpenURL:url];
    if (result) {
      [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:nil];
    }
    resolve(@(result));
  });
}

RCT_EXPORT_METHOD(shareText:(NSString *)shareTitle title:(NSString *)title text:(NSString *)text) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIActivityViewController *controller = [[UIActivityViewController alloc] initWithActivityItems:@[ text ?: @"" ] applicationActivities:nil];
    UIViewController *root = UIApplication.sharedApplication.delegate.window.rootViewController;
    while (root.presentedViewController != nil) root = root.presentedViewController;
    [root presentViewController:controller animated:YES completion:nil];
  });
}

RCT_REMAP_METHOD(getSystemLocales,
                 getSystemLocalesWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter7:(RCTPromiseRejectBlock)reject) {
  resolve(NSLocale.preferredLanguages.firstObject ?: @"en-US");
}

RCT_REMAP_METHOD(getWindowSize,
                 getWindowSizeWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter8:(RCTPromiseRejectBlock)reject) {
  CGSize size = UIScreen.mainScreen.bounds.size;
  resolve(@{ @"width": @(size.width), @"height": @(size.height) });
}

RCT_EXPORT_METHOD(listenWindowSizeChanged) {}

RCT_REMAP_METHOD(isIgnoringBatteryOptimization,
                 isIgnoringBatteryOptimizationWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter9:(RCTPromiseRejectBlock)reject) {
  resolve(@(YES));
}

RCT_REMAP_METHOD(requestIgnoreBatteryOptimization,
                 requestIgnoreBatteryOptimizationWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter10:(RCTPromiseRejectBlock)reject) {
  resolve(@(YES));
}

@end

@interface CacheModule : NSObject <RCTBridgeModule>
@end

@implementation CacheModule

RCT_EXPORT_MODULE();

- (unsigned long long)directorySizeAtPath:(NSString *)path {
  NSArray *files = [[NSFileManager defaultManager] subpathsOfDirectoryAtPath:path error:nil];
  unsigned long long total = 0;
  for (NSString *file in files) {
    NSString *filePath = [path stringByAppendingPathComponent:file];
    NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:filePath error:nil];
    total += attrs.fileSize;
  }
  return total;
}

RCT_REMAP_METHOD(getAppCacheSize,
                 getAppCacheSizeWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  resolve(@([self directorySizeAtPath:NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject]));
}

RCT_REMAP_METHOD(clearAppCache,
                 clearAppCacheWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter2:(RCTPromiseRejectBlock)reject) {
  NSString *cachePath = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
  NSArray *contents = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:cachePath error:nil];
  for (NSString *entry in contents) {
    [[NSFileManager defaultManager] removeItemAtPath:[cachePath stringByAppendingPathComponent:entry] error:nil];
  }
  resolve(nil);
}

@end

@interface CryptoModule : NSObject <RCTBridgeModule>
@end

@implementation CryptoModule

RCT_EXPORT_MODULE();

- (NSData *)dataFromBase64:(NSString *)value {
  return [[NSData alloc] initWithBase64EncodedString:[value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] options:NSDataBase64DecodingIgnoreUnknownCharacters];
}

- (NSString *)base64FromData:(NSData *)data {
  return [data base64EncodedStringWithOptions:0];
}

- (NSData *)derLengthData:(NSUInteger)length {
  if (length < 128) {
    uint8_t value = (uint8_t)length;
    return [NSData dataWithBytes:&value length:1];
  }
  NSMutableData *data = [NSMutableData data];
  NSUInteger value = length;
  while (value > 0) {
    uint8_t byte = value & 0xff;
    [data replaceBytesInRange:NSMakeRange(0, 0) withBytes:&byte length:1];
    value >>= 8;
  }
  uint8_t marker = 0x80 | (uint8_t)data.length;
  [data replaceBytesInRange:NSMakeRange(0, 0) withBytes:&marker length:1];
  return data;
}

- (NSData *)wrapSequence:(NSData *)body {
  NSMutableData *data = [NSMutableData dataWithBytes:(uint8_t[]){0x30} length:1];
  [data appendData:[self derLengthData:body.length]];
  [data appendData:body];
  return data;
}

- (NSData *)wrapPkcs8PrivateKey:(NSData *)pkcs1 {
  const uint8_t version[] = {0x02, 0x01, 0x00};
  const uint8_t algorithm[] = {0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00};
  NSMutableData *octet = [NSMutableData dataWithBytes:(uint8_t[]){0x04} length:1];
  [octet appendData:[self derLengthData:pkcs1.length]];
  [octet appendData:pkcs1];
  NSMutableData *body = [NSMutableData dataWithBytes:version length:sizeof(version)];
  [body appendBytes:algorithm length:sizeof(algorithm)];
  [body appendData:octet];
  return [self wrapSequence:body];
}

- (NSData *)wrapSpkiPublicKey:(NSData *)pkcs1 {
  const uint8_t algorithm[] = {0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00};
  NSMutableData *bitString = [NSMutableData dataWithBytes:(uint8_t[]){0x03} length:1];
  [bitString appendData:[self derLengthData:pkcs1.length + 1]];
  uint8_t zero = 0x00;
  [bitString appendBytes:&zero length:1];
  [bitString appendData:pkcs1];
  NSMutableData *body = [NSMutableData dataWithBytes:algorithm length:sizeof(algorithm)];
  [body appendData:bitString];
  return [self wrapSequence:body];
}

- (BOOL)readDerLengthFromBytes:(const uint8_t *)bytes
                        length:(NSUInteger)length
                        offset:(NSUInteger *)offset
                         value:(NSUInteger *)value {
  if (*offset >= length) return NO;
  uint8_t first = bytes[(*offset)++];
  if ((first & 0x80) == 0) {
    *value = first;
    return *offset + *value <= length;
  }
  NSUInteger byteCount = first & 0x7f;
  if (byteCount == 0 || byteCount > sizeof(NSUInteger) || *offset + byteCount > length) return NO;
  NSUInteger result = 0;
  for (NSUInteger i = 0; i < byteCount; i++) {
    result = (result << 8) | bytes[(*offset)++];
  }
  *value = result;
  return *offset + *value <= length;
}

- (NSData *)unwrapSpkiPublicKey:(NSData *)data {
  const uint8_t *bytes = (const uint8_t *)data.bytes;
  NSUInteger length = data.length;
  NSUInteger offset = 0;
  NSUInteger seqLength = 0;
  if (length == 0 || bytes[offset++] != 0x30 || ![self readDerLengthFromBytes:bytes length:length offset:&offset value:&seqLength]) return data;
  NSUInteger seqEnd = offset + seqLength;
  if (seqEnd > length || offset >= seqEnd || bytes[offset++] != 0x30) return data;
  NSUInteger algorithmLength = 0;
  if (![self readDerLengthFromBytes:bytes length:length offset:&offset value:&algorithmLength]) return data;
  offset += algorithmLength;
  if (offset >= seqEnd || bytes[offset++] != 0x03) return data;
  NSUInteger bitStringLength = 0;
  if (![self readDerLengthFromBytes:bytes length:length offset:&offset value:&bitStringLength]) return data;
  if (bitStringLength < 1 || offset + bitStringLength > length) return data;
  offset += 1;
  bitStringLength -= 1;
  if (offset + bitStringLength > length) return data;
  return [data subdataWithRange:NSMakeRange(offset, bitStringLength)];
}

- (NSData *)unwrapPkcs8PrivateKey:(NSData *)data {
  const uint8_t *bytes = (const uint8_t *)data.bytes;
  NSUInteger length = data.length;
  NSUInteger offset = 0;
  NSUInteger seqLength = 0;
  if (length == 0 || bytes[offset++] != 0x30 || ![self readDerLengthFromBytes:bytes length:length offset:&offset value:&seqLength]) return data;
  NSUInteger seqEnd = offset + seqLength;
  if (seqEnd > length || offset >= seqEnd || bytes[offset++] != 0x02) return data;
  NSUInteger versionLength = 0;
  if (![self readDerLengthFromBytes:bytes length:length offset:&offset value:&versionLength]) return data;
  offset += versionLength;
  if (offset >= seqEnd || bytes[offset++] != 0x30) return data;
  NSUInteger algorithmLength = 0;
  if (![self readDerLengthFromBytes:bytes length:length offset:&offset value:&algorithmLength]) return data;
  offset += algorithmLength;
  if (offset >= seqEnd || bytes[offset++] != 0x04) return data;
  NSUInteger octetLength = 0;
  if (![self readDerLengthFromBytes:bytes length:length offset:&offset value:&octetLength]) return data;
  if (offset + octetLength > length) return data;
  return [data subdataWithRange:NSMakeRange(offset, octetLength)];
}

- (SecKeyRef)createPublicKey:(NSString *)keyString {
  NSData *data = [self dataFromBase64:keyString];
  NSDictionary *attrs = @{
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeRSA,
    (__bridge id)kSecAttrKeyClass: (__bridge id)kSecAttrKeyClassPublic,
    (__bridge id)kSecAttrKeySizeInBits: @2048,
  };
  SecKeyRef key = SecKeyCreateWithData((__bridge CFDataRef)data, (__bridge CFDictionaryRef)attrs, nil);
  if (key != nil) return key;
  NSData *rawData = [self unwrapSpkiPublicKey:data];
  if (rawData.length == data.length && [rawData isEqualToData:data]) return nil;
  return SecKeyCreateWithData((__bridge CFDataRef)rawData, (__bridge CFDictionaryRef)attrs, nil);
}

- (SecKeyRef)createPrivateKey:(NSString *)keyString {
  NSData *data = [self dataFromBase64:keyString];
  NSDictionary *attrs = @{
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeRSA,
    (__bridge id)kSecAttrKeyClass: (__bridge id)kSecAttrKeyClassPrivate,
    (__bridge id)kSecAttrKeySizeInBits: @2048,
  };
  SecKeyRef key = SecKeyCreateWithData((__bridge CFDataRef)data, (__bridge CFDictionaryRef)attrs, nil);
  if (key != nil) return key;
  NSData *rawData = [self unwrapPkcs8PrivateKey:data];
  if (rawData.length == data.length && [rawData isEqualToData:data]) return nil;
  return SecKeyCreateWithData((__bridge CFDataRef)rawData, (__bridge CFDictionaryRef)attrs, nil);
}

- (SecKeyAlgorithm)algorithmForPadding:(NSString *)padding encrypt:(BOOL)encrypt {
  if ([padding isEqualToString:@"RSA/ECB/OAEPWithSHA1AndMGF1Padding"]) {
    return encrypt ? kSecKeyAlgorithmRSAEncryptionOAEPSHA1 : kSecKeyAlgorithmRSAEncryptionOAEPSHA1;
  }
  return encrypt ? kSecKeyAlgorithmRSAEncryptionRaw : kSecKeyAlgorithmRSAEncryptionRaw;
}

RCT_REMAP_METHOD(generateRsaKey,
                 generateRsaKeyWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSDictionary *attrs = @{
    (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeRSA,
    (__bridge id)kSecAttrKeySizeInBits: @2048,
  };
  CFErrorRef error = nil;
  SecKeyRef privateKey = SecKeyCreateRandomKey((__bridge CFDictionaryRef)attrs, &error);
  if (privateKey == nil) {
    reject(@"keygen_failed", @"Failed to generate RSA key", (__bridge NSError *)error);
    return;
  }
  SecKeyRef publicKey = SecKeyCopyPublicKey(privateKey);
  NSData *privateData = CFBridgingRelease(SecKeyCopyExternalRepresentation(privateKey, &error));
  NSData *publicData = CFBridgingRelease(SecKeyCopyExternalRepresentation(publicKey, &error));
  resolve(@{
    @"publicKey": [self base64FromData:[self wrapSpkiPublicKey:publicData]],
    @"privateKey": [self base64FromData:[self wrapPkcs8PrivateKey:privateData]],
  });
  if (publicKey) CFRelease(publicKey);
  if (privateKey) CFRelease(privateKey);
}

- (NSString *)rsaEncryptValue:(NSString *)text key:(NSString *)key padding:(NSString *)padding {
  SecKeyRef publicKey = [self createPublicKey:key];
  if (publicKey == nil) return @"";
  NSData *input = [self dataFromBase64:text];
  CFErrorRef error = nil;
  NSData *output = CFBridgingRelease(SecKeyCreateEncryptedData(publicKey, [self algorithmForPadding:padding encrypt:YES], (__bridge CFDataRef)input, &error));
  CFRelease(publicKey);
  return output ? [self base64FromData:output] : @"";
}

- (NSString *)rsaDecryptValue:(NSString *)text key:(NSString *)key padding:(NSString *)padding {
  SecKeyRef privateKey = [self createPrivateKey:key];
  if (privateKey == nil) return @"";
  NSData *input = [self dataFromBase64:text];
  CFErrorRef error = nil;
  NSData *output = CFBridgingRelease(SecKeyCreateDecryptedData(privateKey, [self algorithmForPadding:padding encrypt:NO], (__bridge CFDataRef)input, &error));
  CFRelease(privateKey);
  if (!output) return @"";
  return [[NSString alloc] initWithData:output encoding:NSUTF8StringEncoding] ?: @"";
}

RCT_REMAP_METHOD(rsaEncrypt,
                 rsaEncryptWithValue:(NSString *)text
                 key:(NSString *)key
                 padding:(NSString *)padding
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter2:(RCTPromiseRejectBlock)reject) {
  resolve([self rsaEncryptValue:text key:key padding:padding]);
}

RCT_REMAP_METHOD(rsaDecrypt,
                 rsaDecryptWithValue:(NSString *)text
                 key:(NSString *)key
                 padding:(NSString *)padding
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter3:(RCTPromiseRejectBlock)reject) {
  resolve([self rsaDecryptValue:text key:key padding:padding]);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaEncryptSync:(NSString *)text key:(NSString *)key padding:(NSString *)padding) {
  return [self rsaEncryptValue:text key:key padding:padding];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaDecryptSync:(NSString *)text key:(NSString *)key padding:(NSString *)padding) {
  return [self rsaDecryptValue:text key:key padding:padding];
}

- (NSString *)aesOperation:(CCOperation)operation text:(NSString *)text key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode {
  NSData *data = [self dataFromBase64:text];
  NSData *keyData = [self dataFromBase64:key];
  NSData *ivData = iv.length ? [self dataFromBase64:iv] : nil;
  size_t outputLength = data.length + kCCBlockSizeAES128;
  NSMutableData *output = [NSMutableData dataWithLength:outputLength];
  uint8_t ivBytes[kCCBlockSizeAES128] = {0};
  if (ivData.length > 0) [ivData getBytes:ivBytes length:MIN(ivData.length, sizeof(ivBytes))];
  CCOptions options = kCCOptionPKCS7Padding;
  const void *ivPtr = ivData.length ? ivBytes : NULL;
  if ([mode isEqualToString:@"AES"]) {
    options |= kCCOptionECBMode;
    ivPtr = NULL;
  }
  size_t moved = 0;
  CCCryptorStatus status = CCCrypt(operation, kCCAlgorithmAES, options, keyData.bytes, keyData.length, ivPtr, data.bytes, data.length, output.mutableBytes, output.length, &moved);
  if (status != kCCSuccess) return @"";
  output.length = moved;
  if (operation == kCCEncrypt) return [self base64FromData:output];
  return [[NSString alloc] initWithData:output encoding:NSUTF8StringEncoding] ?: @"";
}

RCT_REMAP_METHOD(aesEncrypt,
                 aesEncryptWithValue:(NSString *)text
                 key:(NSString *)key
                 iv:(NSString *)iv
                 mode:(NSString *)mode
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter4:(RCTPromiseRejectBlock)reject) {
  resolve([self aesOperation:kCCEncrypt text:text key:key iv:iv mode:mode]);
}

RCT_REMAP_METHOD(aesDecrypt,
                 aesDecryptWithValue:(NSString *)text
                 key:(NSString *)key
                 iv:(NSString *)iv
                 mode:(NSString *)mode
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter5:(RCTPromiseRejectBlock)reject) {
  resolve([self aesOperation:kCCDecrypt text:text key:key iv:iv mode:mode]);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesEncryptSync:(NSString *)text key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode) {
  return [self aesOperation:kCCEncrypt text:text key:key iv:iv mode:mode];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesDecryptSync:(NSString *)text key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode) {
  return [self aesOperation:kCCDecrypt text:text key:key iv:iv mode:mode];
}

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
#if DEBUG
  if ([[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"] != nil) {
    RCTDevSettingsSetEnabled(NO);
  }
#endif
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  [ReactNativeNavigation bootstrapWithBridge:bridge];
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return YES;
}

- (NSArray<id<RCTBridgeModule>> *)extraModulesForBridge:(RCTBridge *)bridge {
  return [ReactNativeNavigation extraModulesForBridge:bridge];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}
- (NSURL *)getBundleURL
{
#if DEBUG
  NSURL *localBundleURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
  if (localBundleURL != nil) {
    return localBundleURL;
  }
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
