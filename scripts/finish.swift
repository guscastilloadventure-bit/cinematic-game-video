// finish.swift: video-only MP4 + WAV -> the delivered MP4 (AAC 256k). Same size: the video is copied as is;
// another size: decoded, Lanczos-scaled and re-encoded at <bitrate>.
//   swiftc -O finish.swift -o finish
//   ./finish <video.mp4> <audio.wav> <out.mp4> [<width> <height> <bitrate>]
import AVFoundation
import CoreImage
import Foundation

let a = CommandLine.arguments
guard a.count == 4 || a.count == 7 else { print("usage: finish <video.mp4> <audio.wav> <out.mp4> [w h bitrate]"); exit(2) }
let vURL = URL(fileURLWithPath: a[1]), aURL = URL(fileURLWithPath: a[2]), outURL = URL(fileURLWithPath: a[3])
let scale = a.count == 7
try? FileManager.default.removeItem(at: outURL)

let vAsset = AVURLAsset(url: vURL), aAsset = AVURLAsset(url: aURL)
let vTrack = vAsset.tracks(withMediaType: .video).first!, aTrack = aAsset.tracks(withMediaType: .audio).first!
let fps = vTrack.nominalFrameRate
let vReader = try AVAssetReader(asset: vAsset), aReader = try AVAssetReader(asset: aAsset)
let vOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: scale ? [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA] : nil)
vOut.alwaysCopiesSampleData = false
vReader.add(vOut)
let aOut = AVAssetReaderTrackOutput(track: aTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 16,
  AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false])
aReader.add(aOut)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
var W = 0, H = 0
let vIn: AVAssetWriterInput
var adaptor: AVAssetWriterInputPixelBufferAdaptor? = nil
if scale {
  W = Int(a[4])!; H = Int(a[5])!
  let color: [String: Any] = [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                              AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                              AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]
  vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoColorPropertiesKey: color,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: Int(a[6])!, AVVideoMaxKeyFrameIntervalKey: Int(fps.rounded()),
                                      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                                      AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC, AVVideoAllowFrameReorderingKey: true]])
  adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vIn, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
    kCVPixelBufferIOSurfacePropertiesKey as String: [:]])
} else {
  vIn = AVAssetWriterInput(mediaType: .video, outputSettings: nil, sourceFormatHint: (vTrack.formatDescriptions.first as! CMFormatDescription))
}
vIn.expectsMediaDataInRealTime = false
writer.add(vIn)
let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000,
  AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 256000])
aIn.expectsMediaDataInRealTime = false
writer.add(aIn)

guard writer.startWriting(), vReader.startReading(), aReader.startReading() else { print("start failed", writer.error ?? vReader.error ?? aReader.error ?? ""); exit(1) }
writer.startSession(atSourceTime: .zero)
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.workingColorSpace: srgb, .outputColorSpace: srgb, .useSoftwareRenderer: false])
let group = DispatchGroup()
let end = vAsset.duration
group.enter()
vIn.requestMediaDataWhenReady(on: DispatchQueue(label: "v")) {
  while vIn.isReadyForMoreMediaData {
    guard let sb = vOut.copyNextSampleBuffer() else { vIn.markAsFinished(); group.leave(); return }
    if let ad = adaptor, let src = CMSampleBufferGetImageBuffer(sb) {
      autoreleasepool {
        var img = CIImage(cvPixelBuffer: src)
        let sx = CGFloat(W) / img.extent.width
        let f = CIFilter(name: "CILanczosScaleTransform")!
        f.setValue(img, forKey: kCIInputImageKey); f.setValue(sx, forKey: kCIInputScaleKey)
        f.setValue(CGFloat(H) / (img.extent.height * sx), forKey: kCIInputAspectRatioKey)
        img = f.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, ad.pixelBufferPool!, &pb)
        ci.render(img, to: pb!, bounds: CGRect(x: 0, y: 0, width: W, height: H), colorSpace: srgb)
        _ = ad.append(pb!, withPresentationTime: CMSampleBufferGetPresentationTimeStamp(sb))
      }
    } else { vIn.append(sb) }
  }
}
group.enter()
aIn.requestMediaDataWhenReady(on: DispatchQueue(label: "a")) {
  while aIn.isReadyForMoreMediaData {
    // the soundtrack stops where the picture does
    if let sb = aOut.copyNextSampleBuffer(), CMTimeCompare(CMSampleBufferGetPresentationTimeStamp(sb), end) < 0 { aIn.append(sb) }
    else { aIn.markAsFinished(); group.leave(); return }
  }
}
group.wait()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { print("failed", writer.error ?? ""); exit(1) }
print("wrote \(outURL.path)")
