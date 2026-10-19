// Thuật toán xếp sự kiện vào các hàng của timeline (hàm thuần, không đụng DOM).
// Trả về danh sách sự kiện kèm allocatedTrackIndex (đã dồn hàng trống) và tổng số hàng.

export function allocateTracks(events) {
    // ========================================================
    // PHÂN PHỐI LÀN SỰ KIỆN THEO TAG & CHU KỲ (TAG & SERIES ALLOCATOR)
    // - Các sự kiện CÙNG TAG:
    //   + Nếu KHÁC mốc thời gian -> xếp NẰM TRÊN CÙNG 1 DÒNG
    //   + Nếu TRÙNG mốc thời gian -> xếp thành CÁC DÒNG LIỀN KỀ NHAU (cạnh nhau)
    // - Nhóm có Tag / nhiều kỳ được ưu tiên xếp trước, nếu sự kiện khác chen vào sẽ bị "đá" ra ngoài!
    // - Nếu không có Tag: tự động gom theo Tên (Title) để giữ các kỳ cùng tên trên cùng 1 dòng
    // ========================================================
    let maxTrack = 0;
    events.forEach(evt => {
        if (typeof evt.track === 'number' && evt.track > maxTrack) {
            maxTrack = evt.track;
        }
    });

    const assignedEvents = [];
    const trackOccupancy = []; // Mảng chứa danh sách các khoảng [{startMs, endMs}] trên từng track

    function ensureTracks(count) {
        while (trackOccupancy.length < count) {
            trackOccupancy.push([]);
        }
    }
    ensureTracks(maxTrack + 1);

    // Kiểm tra xem một danh sách sự kiện có vừa trên trackIndex hay không
    function canChainFitOnTrack(tIndex, eventsList) {
        if (!trackOccupancy[tIndex]) return true;
        for (const occ of trackOccupancy[tIndex]) {
            for (const evt of eventsList) {
                if (Math.max(evt.startMs, occ.startMs) < Math.min(evt.endMs, occ.endMs)) {
                    return false;
                }
            }
        }
        return true;
    }

    // Kiểm tra xem TOÀN BỘ CỤM các làn (lanes) có thể vừa vặn liên tiếp từ startTrack -> startTrack + lanes.length - 1 hay không
    function canGroupFitAt(startTrack, lanes) {
        ensureTracks(startTrack + lanes.length);
        for (let offset = 0; offset < lanes.length; offset++) {
            if (!canChainFitOnTrack(startTrack + offset, lanes[offset])) {
                return false;
            }
        }
        return true;
    }

    // 1. Nhóm sự kiện:
    // - ƯU TIÊN HÀNG ĐẦU: Các sự kiện lặp lại (cùng repeatId hoặc chu kỳ) BẮT BUỘC gom vào cùng 1 nhóm
    //   để đảm bảo toàn bộ chuỗi luôn luôn nằm trên CÙNG MỘT HÀNG!
    // - Tiếp theo: Gom theo Tag nếu có
    // - Tiếp theo: Gom theo Tên (Title)
    // - Cuối cùng: Sự kiện đơn lẻ (Single)
    const groupsMap = {};
    events.forEach(evt => {
        const startMs = new Date(evt.start).getTime();
        const endMs = new Date(evt.end).getTime();
        const eCopy = { ...evt, startMs, endMs };

        const tag = (evt.tag || '').trim().toLowerCase();
        const title = (evt.title || '').trim().toLowerCase();
        const repeatId = evt.repeatId || (evt.repeatType && evt.repeatType !== 'none' ? `rep_${title || evt.id}` : '');
        const isRepeating = !!repeatId;

        let groupKey = '';
        let isTagGroup = false;

        if (repeatId) {
            // Sự kiện lặp lại: Gom toàn bộ chuỗi các lần lặp vào cùng 1 nhóm
            groupKey = `repeat:${repeatId}`;
        } else if (tag) {
            groupKey = `tag:${tag}`;
            isTagGroup = true;
        } else if (title) {
            groupKey = `title:${title}`;
        } else {
            groupKey = `single:${evt.id}`;
        }

        if (!groupsMap[groupKey]) {
            groupsMap[groupKey] = {
                key: groupKey,
                isTag: isTagGroup,
                isRepeating: isRepeating,
                events: []
            };
        }
        groupsMap[groupKey].events.push(eCopy);
    });

    // 2. Với mỗi nhóm, tách thành các làn (lanes) không đè giờ lên nhau
    const groupList = [];
    Object.keys(groupsMap).forEach(gKey => {
        const gData = groupsMap[gKey];
        const evts = gData.events;
        evts.sort((a, b) => a.startMs - b.startMs);

        const lanes = []; // Mỗi lane là 1 chuỗi sự kiện nối tiếp nhau không trùng giờ
        evts.forEach(evt => {
            let placed = false;
            for (const lane of lanes) {
                const overlaps = lane.some(e =>
                    Math.max(evt.startMs, e.startMs) < Math.min(evt.endMs, e.endMs)
                );
                if (!overlaps) {
                    lane.push(evt);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                lanes.push([evt]);
            }
        });

        // Tìm preferredTrack nếu có trong nhóm
        let prefTrack = undefined;
        for (const lane of lanes) {
            for (const evt of lane) {
                if (typeof evt.track === 'number') {
                    if (prefTrack === undefined || evt.track < prefTrack) {
                        prefTrack = evt.track;
                    }
                }
            }
        }

        groupList.push({
            key: gKey,
            isTag: gData.isTag,
            isRepeating: gData.isRepeating,
            lanes: lanes,
            laneCount: lanes.length,
            totalCount: evts.length,
            preferredTrack: prefTrack,
            earliestStart: evts[0].startMs
        });
    });

    // 3. Sắp xếp thứ tự gán dòng:
    // - Nhóm có preferredTrack (cố định) được xếp theo preferredTrack
    // - Nhóm có Tag được ưu tiên xếp trước để bảo lưu cụm dòng liền kề
    // - Sắp xếp tự nhiên theo mốc thời gian bắt đầu (earliestStart): Sự kiện lặp lại vẫn giữ trọn vẹn
    //   trên CÙNG MỘT HÀNG, nhưng không bị ép phải nhảy lên hàng trên cùng!
    groupList.sort((a, b) => {
        const aHasPref = typeof a.preferredTrack === 'number';
        const bHasPref = typeof b.preferredTrack === 'number';

        if (aHasPref && bHasPref) {
            if (a.preferredTrack !== b.preferredTrack) {
                return a.preferredTrack - b.preferredTrack;
            }
            if (a.isTag !== b.isTag) return b.isTag ? 1 : -1;
            if (a.earliestStart !== b.earliestStart) return a.earliestStart - b.earliestStart;
            if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        }

        if (aHasPref && !bHasPref) return -1;
        if (!aHasPref && bHasPref) return 1;

        // 1. Nhóm có Tag được ưu tiên hơn nhóm không có Tag (để gom dòng liên kết)
        if (a.isTag !== b.isTag) return b.isTag ? 1 : -1;

        // 2. Sắp xếp tự nhiên theo mốc thời gian bắt đầu của nhóm
        if (a.earliestStart !== b.earliestStart) {
            return a.earliestStart - b.earliestStart;
        }

        // 3. Nhóm nhiều sự kiện hơn ưu tiên hơn
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;

        return 0;
    });

    // 4. Phân bổ các làn của từng nhóm vào các dòng LIỀN KỀ NHAU (adjacent tracks)
    groupList.forEach(g => {
        const lanes = g.lanes;
        const numLanes = lanes.length;
        let assignedStartTrack = -1;

        // Ưu tiên 1: Đặt vào đúng preferredTrack nếu cả cụm numLanes dòng đều vừa
        if (typeof g.preferredTrack === 'number') {
            if (canGroupFitAt(g.preferredTrack, lanes)) {
                assignedStartTrack = g.preferredTrack;
            }
        }

        // Ưu tiên 2: Tìm cụm numLanes dòng liền kề trống đầu tiên
        if (assignedStartTrack === -1) {
            const searchLimit = Math.max(trackOccupancy.length, maxTrack + 1);
            for (let t = 0; t < searchLimit; t++) {
                if (canGroupFitAt(t, lanes)) {
                    assignedStartTrack = t;
                    break;
                }
            }
        }

        // Ưu tiên 3: Mở thêm các dòng mới ở cuối nếu không cụm nào chứa vừa
        if (assignedStartTrack === -1) {
            assignedStartTrack = trackOccupancy.length;
        }

        ensureTracks(assignedStartTrack + numLanes);

        // Gán từng làn vào từng dòng liền kề: assignedStartTrack + offset
        lanes.forEach((lane, offset) => {
            const trackIdx = assignedStartTrack + offset;
            lane.forEach(evt => {
                trackOccupancy[trackIdx].push({ startMs: evt.startMs, endMs: evt.endMs });
                assignedEvents.push({ ...evt, allocatedTrackIndex: trackIdx });
            });
        });
    });

    // ========================================================
    // TỰ ĐỘNG DỒN HÀNG: Khi một hàng không có sự kiện, dồn các hàng ở dưới lên!
    // ========================================================
    const usedLogicalIndices = [...new Set(assignedEvents.map(e => e.allocatedTrackIndex))].sort((a, b) => a - b);
    const compactTrackMap = new Map();
    usedLogicalIndices.forEach((oldIdx, newIdx) => {
        compactTrackMap.set(oldIdx, newIdx);
    });

    assignedEvents.forEach(evt => {
        evt.allocatedTrackIndex = compactTrackMap.get(evt.allocatedTrackIndex);
    });

    const totalTracksCount = usedLogicalIndices.length;

    return { assignedEvents, totalTracksCount };
}
