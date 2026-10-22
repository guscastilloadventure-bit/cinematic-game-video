// splice.swift: replace the first N frames of a video with new JPEG frames (re-encodes the rest from the source),
// so a change to the opening never needs a full re-render. Video only; `finish` adds the soundtrack.
//   swiftc -O splice.swift -o splice
//   ./splice <framesDir> <N> <source.mp4> <out.mp4> <width> <height> <fps> <bitrate>
import AVFoundation
import CoreImage
import Foundation

let a = CommandLine.arguments
guard a.count == 9 else { print("usage: splice <framesDir> <N> <source.mp4> <out.mp4> <w> <h> <fps> <bitrate>"); exit(2) }
let dir = URL(fileURLWithPath: a[1]), N = Int(a[2])!, srcURL = URL(fileURLWithPath: a[3]), outURL = URL(fileURLWithPath: a[4])
let W = Int(a[5])!, H = Int(a[6])!, FPS = Int32(a[7])!, BITRATE = Int(a[8])!
try? FileManager.default.removeItem(at: outURL)

let src = AVURLAsset(url: srcURL)
let track = src.tracks(withMediaType: .video).first!
let reader = try AVAssetReader(asset: src)
let rOut = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(rOut)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let color: [String: Any] = [AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                            AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                            AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2]
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoColorPropertiesKey: color,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: BITRATE, AVVideoMaxKeyFrameIntervalKey: Int(FPS),
                                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                                    AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
                                    AVVideoExpectedSourceFrameRateKey: Int(FPS), AVVideoAllowFrameReorderingKey: true],
])
vIn.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vIn, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
  kCVPixelBufferIOSurfacePropertiesKey as String: [:],
])
writer.add(vIn)
guard writer.startWriting(), reader.startReading() else { print("start failed", writer.error ?? reader.error ?? ""); exit(1) }
writer.startSession(atSourceTime: .zero)

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.workingColorSpace: srgb, .outputColorSpace: srgb, .useSoftwareRenderer: false])
func put(_ img0: CIImage, _ i: Int) {
  var img = img0
  let sx = CGFloat(W) / img.extent.width
  if abs(sx - 1) > 1e-6 {
    let f = CIFilter(name: "CILanczosScaleTransform")!
    f.setValue(img, forKey: kCIInputImageKey); f.setValue(sx, forKey: kCIInputScaleKey)
    f.setValue(CGFloat(H) / (img.extent.height * sx), forKey: kCIInputAspectRatioKey)
    img = f.outputImage!.cropped(to: CGRect(x: 0, y: 0, width: W, height: H))
  }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  ci.render(img, to: pb!, bounds: CGRect(x: 0, y: 0, width: W, height: H), colorSpace: srgb)
  while !vIn.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
  if !adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: FPS)) { print("append failed", writer.error ?? ""); exit(1) }
}

var i = 0
// the new opening frames
for k in 0..<N {
  autoreleasepool {
    let url = dir.appendingPathComponent(String(format: "f%05d.jpg", k))
    guard let img = CIImage(contentsOf: url) else { print("missing", url.path); exit(1) }
    put(img, i); i += 1
  }
}
// the rest of the source, from frame N on
var n = 0
while let sb = rOut.copyNextSampleBuffer() {
  autoreleasepool {
    if n >= N, let pbs = CMSampleBufferGetImageBuffer(sb) { put(CIImage(cvPixelBuffer: pbs), i); i += 1 }
    n += 1
  }
}
vIn.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { print("failed", writer.error ?? ""); exit(1) }
print("wrote \(outURL.path): \(i) frames (\(N) new + \(i - N) from the source)")
