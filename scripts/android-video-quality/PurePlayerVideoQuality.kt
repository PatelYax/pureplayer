package expo.modules.video.player

import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks

internal class PurePlayerVideoQuality(private val player: Player) {
  private var height: Int? = null

  fun availableHeights(): List<Int> =
    candidates().map { it.height }.distinct().sortedDescending().toList()

  fun select(height: Int?) {
    val override = height?.let {
      requireNotNull(findOverride(it)) { "${it}p is not available on this device for the current video." }
    }
    this.height = height
    applyOverride(override)
  }

  fun refresh() {
    val height = height ?: return
    applyOverride(findOverride(height))
  }

  fun reset() {
    if (height != null) select(null)
  }

  private fun findOverride(height: Int): TrackSelectionOverride? =
    candidates().filter { it.height == height }.maxByOrNull { it.bitrate }
      ?.let { TrackSelectionOverride(it.group.mediaTrackGroup, it.index) }

  private fun applyOverride(override: TrackSelectionOverride?) {
    val current = player.trackSelectionParameters
    val builder = current.buildUpon().clearOverridesOfType(C.TRACK_TYPE_VIDEO)
    if (override != null) builder.addOverride(override)
    val next = builder.build()
    if (next != current) player.trackSelectionParameters = next
  }

  private fun candidates(): Sequence<Candidate> = sequence {
    for (group in player.currentTracks.groups) {
      if (group.type != C.TRACK_TYPE_VIDEO) continue
      for (index in 0 until group.length) {
        val format = group.getTrackFormat(index)
        if (group.isTrackSupported(index) && format.height > 0 &&
          (format.roleFlags and C.ROLE_FLAG_TRICK_PLAY) == 0
        ) {
          yield(Candidate(group, index, format.height, format.bitrate))
        }
      }
    }
  }

  private data class Candidate(val group: Tracks.Group, val index: Int, val height: Int, val bitrate: Int)
}
