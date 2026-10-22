// thumbs.swift <video.mp4> <outDir> <seconds>... : JPEG stills from a video (review sheets, posters)
import AVFoundation
import Foundation
let a = CommandLine.arguments
let gen = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: a[1])))
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: Double(ProcessInfo.processInfo.environment["TW"] ?? "960")!, height: 2160)
for s in a.dropFirst(3) {
  let t = CMTime(seconds: Double(s)!, preferredTimescale: 600)
  guard let img = try? gen.copyCGImage(at: t, actualTime: nil) else { print("no frame at", s); continue }
  let url = URL(fileURLWithPath: a[2]).appendingPathComponent("t\(s).jpg") as CFURL
  let dst = CGImageDestinationCreateWithURL(url, "public.jpeg" as CFString, 1, nil)!
  CGImageDestinationAddImage(dst, img, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
  CGImageDestinationFinalize(dst)
}
