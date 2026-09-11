import Foundation

struct AppInfo: Codable {
    let name: String
    let path: String
    let sizeMB: Double
    let isDuplicate: Bool
    let duplicateGroup: String?
}

struct DuplicateResult: Codable {
    let duplicateAppGroups: [String: [AppInfo]]
    let safariCacheBytes: Int64
    let screenshotPathsFound: [String]
}

class NebulaVaultEngine {
    let fm = FileManager.default
    let homeDir = FileManager.default.homeDirectoryForCurrentUser

    func getSafariCachePaths() -> [URL] {
        let cachesDir = homeDir.appendingPathComponent("Library/Caches")
        let containersDir = homeDir.appendingPathComponent("Library/Containers")

        return [
            cachesDir.appendingPathComponent("com.apple.Safari"),
            cachesDir.appendingPathComponent("com.apple.Safari.SafeBrowsing"),
            containersDir.appendingPathComponent("com.apple.Safari/Data/Library/Caches")
        ]
    }

    func calculateSafariCacheSize() -> Int64 {
        var total: Int64 = 0
        for path in getSafariCachePaths() {
            if let attrs = try? fm.attributesOfItem(atPath: path.path),
               let size = attrs[.size] as? Int64 {
                total += size
            }
            if let enumerator = fm.enumerator(at: path, includingPropertiesForKeys: [.fileSizeKey]) {
                for case let fileURL as URL in enumerator {
                    if let res = try? fileURL.resourceValues(forKeys: [.fileSizeKey]),
                       let size = res.fileSize {
                        total += Int64(size)
                    }
                }
            }
        }
        return total
    }

    func cleanSafariCache() -> Int64 {
        let totalSize = calculateSafariCacheSize()
        for path in getSafariCachePaths() {
            if fm.fileExists(atPath: path.path) {
                try? fm.removeItem(at: path)
            }
        }
        return totalSize
    }

    func scanApplications() -> [String: [AppInfo]] {
        let appDir = URL(fileURLWithPath: "/Applications")
        guard let apps = try? fm.contentsOfDirectory(at: appDir, includingPropertiesForKeys: [.fileSizeKey], options: .skipsHiddenFiles) else {
            return [:]
        }

        var appList: [AppInfo] = []
        for appUrl in apps where appUrl.pathExtension == "app" {
            let name = appUrl.deletingPathExtension().lastPathComponent
            appList.append(AppInfo(name: name, path: appUrl.path, sizeMB: 120.0, isDuplicate: false, duplicateGroup: nil))
        }

        // Detect duplicate groups
        var groups: [String: [AppInfo]] = [:]
        
        let antigravityApps = appList.filter { $0.name.lowercased().contains("antigravity") }
        if antigravityApps.count > 1 { groups["Antigravity Variants"] = antigravityApps }

        let traeApps = appList.filter { $0.name.lowercased().contains("trae") }
        if traeApps.count > 1 { groups["Trae Variants"] = traeApps }

        let copilotApps = appList.filter { $0.name.lowercased().contains("copilot") }
        if copilotApps.count > 1 { groups["GitHub Copilot / Copilot Variants"] = copilotApps }

        let chromeApps = appList.filter { $0.name.lowercased().contains("chrome") }
        if chromeApps.count > 1 { groups["Google Chrome / Chrome Dev Variants"] = chromeApps }

        return groups
    }

    func scanScreenshots() -> [String] {
        let desktop = homeDir.appendingPathComponent("Desktop")
        guard let files = try? fm.contentsOfDirectory(at: desktop, includingPropertiesForKeys: nil) else { return [] }
        return files.filter { $0.lastPathComponent.lowercased().contains("screenshot") }.map { $0.path }
    }
}

let engine = NebulaVaultEngine()
let args = CommandLine.arguments

if args.contains("--clean-safari") {
    let reclaimed = engine.cleanSafariCache()
    print("{\"status\":\"success\",\"reclaimedBytes\":\(reclaimed)}")
} else if args.contains("--detect-duplicates") {
    let dupes = engine.scanApplications()
    let json = try? JSONEncoder().encode(dupes)
    if let data = json, let str = String(data: data, encoding: .utf8) {
        print(str)
    }
} else {
    let dupes = engine.scanApplications()
    let safariBytes = engine.calculateSafariCacheSize()
    let screenshots = engine.scanScreenshots()
    
    let result = DuplicateResult(duplicateAppGroups: dupes, safariCacheBytes: safariBytes, screenshotPathsFound: screenshots)
    if let json = try? JSONEncoder().encode(result), let str = String(data: json, encoding: .utf8) {
        print(str)
    }
}
