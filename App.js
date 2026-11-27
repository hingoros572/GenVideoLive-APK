
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert, Image, Animated, RefreshControl,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
  Share, Dimensions, Linking
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as MediaLibrary from "expo-media-library";
import * as VideoThumbnails from "expo-video-thumbnails";
import { CameraView, Camera } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Video, ResizeMode, Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import MediaEngine from "@projectyoked/expo-media-engine";
// Preview playback uses expo-av; MediaEngine handles final native composition.
import { GestureHandlerRootView } from "react-native-gesture-handler";

const API_KEY = "AIzaSyCoE-u18gD7wBg20dtLBtctQbM6KHzUFtk";
const DATABASE_URL = "https://gen-video-live-default-rtdb.asia-southeast1.firebasedatabase.app";
const CLOUD_NAME = "esfbp8hc";
const UPLOAD_PRESET = "gen_video_live_upload";
const SESSION_STORAGE_KEY = "genVideoLive.session.v1";

const C = {
  bg: "#10101a",
  card: "#1c1c2b",
  card2: "#25253a",
  pink: "#ff315f",
  magenta: "#ff4fc8",
  white: "#ffffff",
  gray: "#aaaabd",
  green: "#38d996",
  gold: "#e7b94b"
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

// Profile/feed mein sirf asli playable video posts dikhayein.
function isRealVideoPost(post) {
  const hasVideo=!!(post && typeof post.videoUrl === "string" && /^https?:\/\//i.test(post.videoUrl));
  const hasPhotos=!!(post && Array.isArray(post.photoUrls) && post.photoUrls.some(url=>typeof url==="string"&&/^https?:\/\//i.test(url)));
  return hasVideo||hasPhotos;
}

// Profile grid thumbnail is generated from the exact uploaded video URL.
// Do not use manually selected cover images or demo/sample artwork here.
function getVideoThumbnail(post) {
  const url = post?.videoUrl || "";
  if (!/^https?:\/\//i.test(url)) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return "";
  return url
    .replace("/video/upload/", "/video/upload/so_0,w_480,h_720,c_fill/")
    .replace(/\.(mp4|mov|m4v|webm)(\?.*)?$/i, ".jpg");
}

function Button({ title, onPress, secondary, disabled, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.button, secondary && styles.secondaryButton, disabled && {opacity:0.5}, style]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function NavItem({ icon, label, active, onPress }) {
  const iconColor = active ? C.white : "#d8d8e2";
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.75}>
      {icon === "create" ? (
        <View style={styles.createNavIcon}>
          <View style={styles.createNavBlue}/>
          <View style={styles.createNavPink}/>
          <View style={styles.createNavWhite}>
            <Text style={styles.createNavPlus}>+</Text>
          </View>
        </View>
      ) : icon === "home" ? (
        <View style={styles.navHomeIcon}>
          <View style={[styles.navHomeRoof,{borderColor:iconColor}]}/>
          <View style={[styles.navHomeBody,{borderColor:iconColor}]}>
            <View style={[styles.navHomeDoor,{backgroundColor:active?C.pink:iconColor}]}/>
          </View>
        </View>
      ) : icon === "friends" ? (
        <View style={styles.navPeopleIcon}>
          <View style={[styles.navPersonHead,{backgroundColor:iconColor,left:7}]}/>
          <View style={[styles.navPersonHeadSmall,{backgroundColor:iconColor,right:3}]}/>
          <View style={[styles.navPersonBody,{backgroundColor:iconColor,left:1}]}/>
          <View style={[styles.navPersonBodySmall,{backgroundColor:iconColor,right:0}]}/>
        </View>
      ) : icon === "inbox" ? (
        <View style={[styles.navInboxIcon,{borderColor:iconColor}]}>
          <View style={[styles.navInboxFlap,{borderColor:iconColor}]}/>
        </View>
      ) : (
        <View style={styles.navProfileIcon}>
          <View style={[styles.navProfileHead,{borderColor:iconColor}]}/>
          <View style={[styles.navProfileShoulders,{borderColor:iconColor}]}/>
        </View>
      )}
      <Text style={[styles.navLabel,{color:active?C.pink:C.gray}]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SpinningDisc({ avatarUrl }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin,{
        toValue:1,duration:5000,useNativeDriver:true
      })
    );
    animation.start();
    return () => animation.stop();
  },[spin]);

  const rotate = spin.interpolate({
    inputRange:[0,1],
    outputRange:["0deg","360deg"]
  });

  return (
    <Animated.View style={[styles.disc,{transform:[{rotate}]}]}>
      <View style={styles.discCenter}>
        {avatarUrl ? (
          <Image source={{uri:avatarUrl}} style={styles.discAvatar}/>
        ) : (
          <Text>👑</Text>
        )}
      </View>
    </Animated.View>
  );
}

// REEL CARD
function ReelCard({
  reel,height,liked,saved,following,isActive,showViews=true,likeCount,commentCount=0,saveCount=0,shareCount=0,repostCount=0,reposted=false,
  onLike,onDoubleLike,onSave,onFollow,onComment,onCommentLongPress,onQuickReaction,onShare,onRepost,onSound,onOpenProfile,isOwner,onDelete
}) {
  const lastTapRef = useRef(0);
  const touchStartRef = useRef(null);
  const heartScale = useRef(new Animated.Value(0.35)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const [showReactionPicker,setShowReactionPicker] = useState(false);

  function handleVideoTouchStart(event) {
    const {pageX,pageY} = event.nativeEvent;
    touchStartRef.current = {x:pageX,y:pageY};
  }

  function handleVideoTouchEnd(event) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const {pageX,pageY} = event.nativeEvent;
    if (Math.abs(pageX-start.x)>22 || Math.abs(pageY-start.y)>22) return;

    const now = Date.now();
    if (now-lastTapRef.current < 320) {
      lastTapRef.current = 0;
      onDoubleLike?.();
      heartScale.setValue(0.35);
      heartOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartScale,{toValue:1.2,useNativeDriver:true,friction:4}),
        Animated.parallel([
          Animated.timing(heartOpacity,{toValue:0,duration:420,useNativeDriver:true}),
          Animated.timing(heartScale,{toValue:0.9,duration:420,useNativeDriver:true})
        ])
      ]).start();
    } else {
      lastTapRef.current = now;
    }
  }

  return (
    <View style={[styles.reelPage,{height,backgroundColor:reel.background||"#21172d"}]}>
      {reel.videoUrl ? (
        <Video
          source={{uri:reel.videoUrl}}
          style={styles.reelVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={!!isActive}
          isMuted={!isActive}
          volume={isActive?1:0}
          isLooping
          useNativeControls={false}
        />
      ) : reel.photoUrls?.length ? (
        <Image source={{uri:reel.photoUrls[0]}} style={styles.reelVideo} resizeMode="contain"/>
      ) : (
        <View style={styles.reelCenter}>
          <Text style={styles.reelEmoji}>{reel.emoji||"🎬"}</Text>
          <Text style={styles.demoLabel}>Sample Reel</Text>
        </View>
      )}

      <View
        style={styles.doubleTapArea}
        onTouchStart={handleVideoTouchStart}
        onTouchEnd={handleVideoTouchEnd}
      />
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.doubleTapHeart,
          {opacity:heartOpacity,transform:[{scale:heartScale}]}
        ]}
      >
        ❤️
      </Animated.Text>

      {showViews&&(
        <View style={styles.reelViewBadge}>
          <Text style={styles.reelViewText}>◉ {Object.keys(reel.viewsByUser||{}).length}</Text>
        </View>
      )}

      <View style={styles.reelBottom}>
        {!!reel.repostedByUsername&&<Text style={styles.repostAttribution}>↻ Reposted by @{reel.repostedByUsername}</Text>}
        <TouchableOpacity onPress={()=>onOpenProfile?.(reel.ownerId)} disabled={!reel.ownerId}><Text style={styles.creatorName}>@{reel.creator||"Creator"}</Text></TouchableOpacity>
        <Text style={styles.caption}>{reel.caption||""}</Text>
      </View>

      <View style={styles.actionStack}>
        <View style={styles.creatorFollow}>
          <TouchableOpacity style={styles.creatorAvatarRing} onPress={()=>onOpenProfile?.(reel.ownerId)} disabled={!reel.ownerId}>
            {reel.avatarUrl ? (
              <Image source={{uri:reel.avatarUrl}} style={styles.creatorAvatarImage}/>
            ) : (
              <View style={styles.creatorAvatarFallback}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.followPlus,following&&styles.followedButton]}
            onPress={onFollow}
          >
            <Text style={styles.followPlusText}>{following?"✓":"+"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
          <Text style={styles.actionIcon}>{liked?"❤️":"🤍"}</Text>
          <Text style={styles.actionCount}>
            {Number(likeCount??(Number(reel.likes||0)+(liked?1:0))).toLocaleString()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={()=>{setShowReactionPicker(false);onComment?.();}}
          onLongPress={()=>setShowReactionPicker(true)}
          delayLongPress={450}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{Number(commentCount||0).toLocaleString()}</Text>
        </TouchableOpacity>
        {showReactionPicker&&(
          <>
            <TouchableOpacity style={styles.reactionDismissArea} activeOpacity={1} onPress={()=>setShowReactionPicker(false)}/>
            <View style={styles.quickReactionPicker}>
              {["🥰","😁","😂","😮"].map(emoji=>(
                <TouchableOpacity key={emoji} style={styles.quickReactionButton} onPress={()=>{setShowReactionPicker(false);onQuickReaction?.(emoji);}}>
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={onSave}>
          <View style={[styles.bookmarkIcon,{borderColor:saved?C.gold:C.white}]}>
            <View style={[styles.bookmarkCutLeft,{backgroundColor:saved?C.gold:C.white}]}/>
            <View style={[styles.bookmarkCutRight,{backgroundColor:saved?C.gold:C.white}]}/>
          </View>
          <Text style={styles.actionCount}>{Number(saveCount||0).toLocaleString()}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
          <Text style={styles.actionIcon}>↗️</Text>
          <Text style={styles.actionCount}>{Number(shareCount||0).toLocaleString()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onRepost}>
          <Text style={[styles.actionIcon,{color:reposted?C.magenta:C.white}]}>🔁</Text>
          <Text style={styles.actionCount}>{Number(repostCount||0).toLocaleString()}</Text>
        </TouchableOpacity>
        {isOwner&&(
          <TouchableOpacity style={styles.postMoreButton} onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete your post">
            <Text style={styles.postMoreText}>•••</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.soundNameButton} onPress={onSound} activeOpacity={0.85}>
          <Text style={styles.soundNameIcon}>♫</Text>
          <Text style={styles.soundNameText} numberOfLines={1}>{reel.music||"Original Sound"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [showIntro,setShowIntro] = useState(true);
  const introGen = useRef(new Animated.Value(0)).current;
  const introVideo = useRef(new Animated.Value(0)).current;
  const introLive = useRef(new Animated.Value(0)).current;
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [signupUsername,setSignupUsername] = useState("");
  const [isSignup,setIsSignup] = useState(false);
  const [loading,setLoading] = useState(false);

  const [user,setUser] = useState(null);
  const [sessionLoading,setSessionLoading] = useState(true);

  useEffect(()=>{
    const sequence=Animated.stagger(620,[introGen,introVideo,introLive].map(value =>
      Animated.spring(value,{toValue:1,useNativeDriver:true,speed:3,bounciness:9})
    ));
    sequence.start();
    const voiceTimer=setTimeout(()=>Speech.speak("Welcome Gen Video Live",{language:"en-US",rate:0.88,pitch:1.0}),2300);
    const finishTimer=setTimeout(()=>setShowIntro(false),5700);
    return ()=>{
      clearTimeout(voiceTimer);
      clearTimeout(finishTimer);
      sequence.stop();
      Speech.stop();
    };
  },[]);
  const [username,setUsername] = useState("");
  const [appLanguage,setAppLanguage] = useState("auto");
  const [bio,setBio] = useState("Welcome to my Gen Video Live profile! 👑");
  const [location,setLocation] = useState("");
  const [profileImage,setProfileImage] = useState("");
  const [coverImage,setCoverImage] = useState("");
  const [editUsername,setEditUsername] = useState("");
  const [editBio,setEditBio] = useState("");
  const [editLocation,setEditLocation] = useState("");
  const [editProfileImage,setEditProfileImage] = useState("");
  const [editCoverImage,setEditCoverImage] = useState("");
  const [youtubeLink,setYoutubeLink] = useState("");
  const [editYoutubeLink,setEditYoutubeLink] = useState("");
  const [userProfiles,setUserProfiles] = useState({});
  const [selectedProfileId,setSelectedProfileId] = useState(null);
  const [selectedProfileData,setSelectedProfileData] = useState(null);
  const [selectedProfileFollowerCount,setSelectedProfileFollowerCount] = useState(0);
  const [messageDraft,setMessageDraft] = useState("");
  const [chatInputFocused,setChatInputFocused] = useState(false);
  const messageScrollRef = useRef(null);
  const [messageSendingText,setMessageSendingText] = useState(false);

  const [page,setPage] = useState("Home");
  const [feedTab,setFeedTab] = useState("For You");
  const [profileTab,setProfileTab] = useState("Videos");

  const [posts,setPosts] = useState([]);
  const [following,setFollowing] = useState({});
  const [mutualFriends,setMutualFriends] = useState([]);
  const [refreshing,setRefreshing] = useState(false);
  const [followerCount,setFollowerCount] = useState(0);
  const [liked,setLiked] = useState({});
  const [saved,setSaved] = useState({});
  const [likeCounts,setLikeCounts] = useState({});
  const [commentCounts,setCommentCounts] = useState({});
  const [saveCounts,setSaveCounts] = useState({});
  const [shareCounts,setShareCounts] = useState({});
  const [repostCounts,setRepostCounts] = useState({});
  const [reposts,setReposts] = useState({});
  const [myReposts,setMyReposts] = useState({});
  const [userChats,setUserChats] = useState({});
  const [messageRequests,setMessageRequests] = useState({});
  const [inboxFilter,setInboxFilter] = useState("Main");
  const [inboxSearchOpen,setInboxSearchOpen] = useState(false);
  const [inboxSearch,setInboxSearch] = useState("");
  const [shareModalVisible,setShareModalVisible] = useState(false);
  const [shareTargetPost,setShareTargetPost] = useState(null);
  const [recipientQuery,setRecipientQuery] = useState("");
  const [recipientResults,setRecipientResults] = useState([]);
  const [recipientLoading,setRecipientLoading] = useState(false);
  const [selectedChat,setSelectedChat] = useState(null);
  const [conversationMessages,setConversationMessages] = useState([]);
  const [conversationLoading,setConversationLoading] = useState(false);
  const [messageText,setMessageText] = useState("");
  const [messageSending,setMessageSending] = useState(false);
  const [commentsVisible,setCommentsVisible] = useState(false);
  const [commentPost,setCommentPost] = useState(null);
  const [comments,setComments] = useState([]);
  const [commentsLoading,setCommentsLoading] = useState(false);
  const [commentText,setCommentText] = useState("");
  const [commentImage,setCommentImage] = useState(null);
  const [commentSending,setCommentSending] = useState(false);
  const commentInputRef = useRef(null);

  const [selectedVideo,setSelectedVideo] = useState(null);
  const [selectedEditorTool,setSelectedEditorTool] = useState("");
  const [caption,setCaption] = useState("");
  const [privacy,setPrivacy] = useState("Public");
  const [uploading,setUploading] = useState(false);
  const [uploadProgress,setUploadProgress] = useState(0);
  const [uploadStage,setUploadStage] = useState("");
  // Create/upload workflow pages and post metadata
  const [createStep,setCreateStep] = useState("camera");
  const [createPhotos,setCreatePhotos] = useState([]);
  const [selectedCreateMedia,setSelectedCreateMedia] = useState([]);
  const [selectedTimelineIndex,setSelectedTimelineIndex] = useState(0);
  const [trimRanges,setTrimRanges] = useState({});
  const [timelineWidth,setTimelineWidth] = useState(220);
  const [trimDragSide,setTrimDragSide] = useState(null);
  const trimGestureRef = useRef(null);
  const [timelineThumbs,setTimelineThumbs] = useState({});
  const [editorPlaybackSeconds,setEditorPlaybackSeconds] = useState(0);
  const [editorIsPlaying,setEditorIsPlaying] = useState(true);
  const editorVideoRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const [clipMuteStates,setClipMuteStates] = useState({});
  const [previewBoxVisible,setPreviewBoxVisible] = useState(false);
  const [previewScale,setPreviewScale] = useState(1);
  const [previewShift,setPreviewShift] = useState({x:0,y:0});
  const previewGestureRef = useRef({x:0,y:0,scale:1,shiftX:0,shiftY:0,mode:"move"});
  const [addingToTimeline,setAddingToTimeline] = useState(false);
  useEffect(()=>{
    let cancelled=false;
    async function buildTimelineThumbs(){
      const entries=await Promise.all((selectedCreateMedia||[]).map(async item=>{
        if(!item?.uri)return null;
        if(item.type==="image"||item.mimeType?.startsWith("image/"))return [item.uri,item.uri];
        try{
          const result=await VideoThumbnails.getThumbnailAsync(item.uri,{time:500});
          return [item.uri,result.uri];
        }catch(error){return [item.uri,item.uri];}
      }));
      if(!cancelled)setTimelineThumbs(Object.fromEntries(entries.filter(Boolean)));
    }
    buildTimelineThumbs();
    return ()=>{cancelled=true;};
  },[selectedCreateMedia]);

  const cameraRef = useRef(null);
  const [cameraPermissionGranted,setCameraPermissionGranted] = useState(false);
  const [microphonePermissionGranted,setMicrophonePermissionGranted] = useState(false);
  const [cameraFacing,setCameraFacing] = useState("back");
  const [isRecording,setIsRecording] = useState(false);
  const [torchEnabled,setTorchEnabled] = useState(false);
  const [cameraFilter,setCameraFilter] = useState("clear");
  const [activeCameraFilterCategory,setActiveCameraFilterCategory] = useState("Life / Daily");
  const [cameraBrightness,setCameraBrightness] = useState(0);
  const [showBrightnessControl,setShowBrightnessControl] = useState(false);
  const [showCameraTools,setShowCameraTools] = useState(true);
  const cameraFilterCategories=[{"category":"Life / Daily","slug":"life-daily","filters":[{"id":1,"name":"Clear","slug":"clear","tint":null,"engineFilter":"warm"},{"id":2,"name":"Warm","slug":"warm","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":3,"name":"Fresh","slug":"fresh","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":4,"name":"Natural","slug":"natural","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":5,"name":"Bright","slug":"bright","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":6,"name":"Daily","slug":"daily","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":7,"name":"Cozy","slug":"cozy","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":8,"name":"Sunlight","slug":"sunlight","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":9,"name":"Morning","slug":"morning","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":10,"name":"Clean","slug":"clean","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"}]},{"category":"Food","slug":"food","filters":[{"id":1,"name":"Delicious","slug":"delicious","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":2,"name":"Tasty","slug":"tasty","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":3,"name":"Sweet","slug":"sweet","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":4,"name":"Crisp","slug":"crisp","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":5,"name":"Appetite","slug":"appetite","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":6,"name":"Juicy","slug":"juicy","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":7,"name":"Coffee","slug":"coffee","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":8,"name":"Cream","slug":"cream","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":9,"name":"BBQ","slug":"bbq","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"}]},{"category":"Movies / Cinematic","slug":"movies-cinematic","filters":[{"id":1,"name":"Teal & Orange","slug":"teal-and-orange","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":2,"name":"Oppenheimer","slug":"oppenheimer","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":3,"name":"Dune","slug":"dune","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":4,"name":"Cyberpunk","slug":"cyberpunk","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":5,"name":"Nolan","slug":"nolan","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":6,"name":"Dark Night","slug":"dark-night","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":7,"name":"Teal","slug":"teal","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":8,"name":"Moody","slug":"moody","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":9,"name":"Blockbuster","slug":"blockbuster","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":10,"name":"Hollywood","slug":"hollywood","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":11,"name":"Cold Blue","slug":"cold-blue","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"}]},{"category":"Retro / Vintage","slug":"retro-vintage","filters":[{"id":1,"name":"1990s","slug":"1990s","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":2,"name":"1980s","slug":"1980s","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":3,"name":"VHS","slug":"vhs","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":4,"name":"Kodak","slug":"kodak","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":5,"name":"Polaroid","slug":"polaroid","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":6,"name":"Film","slug":"film","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":7,"name":"Nostalgia","slug":"nostalgia","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":8,"name":"Sepia","slug":"sepia","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":9,"name":"Old Movie","slug":"old-movie","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":10,"name":"Fade","slug":"fade","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":11,"name":"Grain","slug":"grain","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"}]},{"category":"Scenery / Nature","slug":"scenery-nature","filters":[{"id":1,"name":"Blue Sky","slug":"blue-sky","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":2,"name":"Green","slug":"green","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":3,"name":"Sunset","slug":"sunset","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":4,"name":"Forest","slug":"forest","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":5,"name":"Ocean","slug":"ocean","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":6,"name":"Mountain","slug":"mountain","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":7,"name":"Autumn","slug":"autumn","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":8,"name":"Spring","slug":"spring","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":9,"name":"Golden Hour","slug":"golden-hour","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":10,"name":"Twilight","slug":"twilight","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"}]},{"category":"Style / Aesthetic","slug":"style-aesthetic","filters":[{"id":1,"name":"Black Forest","slug":"black-forest","tint":"rgba(100,100,100,0.34)","engineFilter":"grayscale"},{"id":2,"name":"Caramel","slug":"caramel","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":3,"name":"Milk Tea","slug":"milk-tea","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":4,"name":"Mocha","slug":"mocha","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":5,"name":"Lavender","slug":"lavender","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":6,"name":"Rose","slug":"rose","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":7,"name":"Coral","slug":"coral","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"},{"id":8,"name":"Champagne","slug":"champagne","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":9,"name":"Mint","slug":"mint","tint":"rgba(255,95,140,0.14)","engineFilter":"saturation"}]},{"category":"B&W (Black & White)","slug":"black-and-white","filters":[{"id":1,"name":"Noir","slug":"noir","tint":"rgba(100,100,100,0.34)","engineFilter":"grayscale"},{"id":2,"name":"Classic B&W","slug":"classic-bandw","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":3,"name":"Monochrome","slug":"monochrome","tint":"rgba(100,100,100,0.34)","engineFilter":"grayscale"},{"id":4,"name":"Contrast B&W","slug":"contrast-bandw","tint":"rgba(40,30,45,0.18)","engineFilter":"contrast"},{"id":5,"name":"Silver","slug":"silver","tint":"rgba(255,155,75,0.16)","engineFilter":"warm"},{"id":6,"name":"Grayscale","slug":"grayscale","tint":"rgba(100,100,100,0.34)","engineFilter":"grayscale"},{"id":7,"name":"Ink","slug":"ink","tint":"rgba(100,100,100,0.34)","engineFilter":"grayscale"}]},{"category":"Night / Low Light","slug":"night-low-light","filters":[{"id":1,"name":"Neon","slug":"neon","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":2,"name":"City Night","slug":"city-night","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":3,"name":"Midnight","slug":"midnight","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":4,"name":"Moonlight","slug":"moonlight","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":5,"name":"Starlight","slug":"starlight","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"},{"id":6,"name":"Cyber Night","slug":"cyber-night","tint":"rgba(75,155,255,0.17)","engineFilter":"cool"}]}];
  const cameraFilters=cameraFilterCategories.flatMap(category=>category.filters.map(filter=>({...filter,label:filter.name})));
  const [galleryTab,setGalleryTab] = useState("All");
  const [galleryUseLayout,setGalleryUseLayout] = useState(false);
  const [galleryAssets,setGalleryAssets] = useState([]);
  const [galleryLoading,setGalleryLoading] = useState(false);
  const [gallerySelectedIds,setGallerySelectedIds] = useState([]);
  const [drafts,setDrafts] = useState([]);
  const [soundReturnPage,setSoundReturnPage] = useState("Home");
  const [postCoverImage,setPostCoverImage] = useState(null);
  const [postHashtags,setPostHashtags] = useState("");
  const [postMention,setPostMention] = useState("");
  const [postLocation,setPostLocation] = useState("");
  const [postLink,setPostLink] = useState("");
  const [openPostSection,setOpenPostSection] = useState("");
  const [allowComments,setAllowComments] = useState(true);
  const [allowReuse,setAllowReuse] = useState(true);
  const [videoLanguage,setVideoLanguage] = useState("English");
  const [aiGenerated,setAiGenerated] = useState(false);
  const [saveAsDraft,setSaveAsDraft] = useState(false);

  const [selectedSound,setSelectedSound] = useState("");
  const [soundTitle,setSoundTitle] = useState("Dil Se Dil Tak");
  const [renameSoundOpen,setRenameSoundOpen] = useState(false);
  const [renameSoundText,setRenameSoundText] = useState("");
  const [renamingSound,setRenamingSound] = useState(false);
  const [soundCreator,setSoundCreator] = useState("Gen Video Live");
  const [soundAvatarUrl,setSoundAvatarUrl] = useState("");
  const [soundSourceVideoUrl,setSoundSourceVideoUrl] = useState("");
  const [soundSourcePostId,setSoundSourcePostId] = useState("");
  const [soundSearchText,setSoundSearchText] = useState("");
  const [soundSaved,setSoundSaved] = useState(false);
  const [selectedSoundVolume,setSelectedSoundVolume] = useState(100);
  const [originalVideoVolume,setOriginalVideoVolume] = useState(0);
  const [playingPost,setPlayingPost] = useState(null);

  const [activeReelIndex,setActiveReelIndex] = useState(0);
  const viewedPostIdsRef = useRef({});
  const [feedHeight,setFeedHeight] = useState(0);
  const feedScrollRef = useRef(null);

  useEffect(()=>{
    AsyncStorage.getItem("genVideoLive.appLanguage.v1").then(value=>{
      if(value) setAppLanguage(value);
    }).catch(error=>console.log("LANGUAGE PREFERENCE LOAD ERROR:",error.message));
  },[]);

  const liveUnlocked = followerCount >= 1000;
  const statusHeight = Platform.OS==="android"?(StatusBar.currentHeight||0):0;
  const reelHeight = feedHeight || SCREEN_HEIGHT-62-66-statusHeight;

  useEffect(()=>{
    if(page!=="Create"||createStep!=="camera") return;
    let active=true;
    (async()=>{
      try {
        const cameraResult=await Camera.requestCameraPermissionsAsync();
        const micResult=await Camera.requestMicrophonePermissionsAsync();
        if(active) {
          setCameraPermissionGranted(!!cameraResult.granted);
          setMicrophonePermissionGranted(!!micResult.granted);
        }
      } catch(error) {
        if(active) Alert.alert("Camera Permission",error.message||"Camera permission allow karein.");
      }
    })();
    return ()=>{active=false;};
  },[page,createStep]);

  useEffect(()=>{
    Audio.setAudioModeAsync({
      playsInSilentModeIOS:true,
      shouldDuckAndroid:false,
      playThroughEarpieceAndroid:false,
      staysActiveInBackground:false
    }).catch(error=>console.log("AUDIO MODE ERROR:",error));
  },[]);

  // Restore the signed-in account using Firebase's refresh token.
  // Keep the branded launch screen visible for at least two seconds.
  useEffect(()=>{
    let active=true;
    async function restoreSession(){
      const startedAt=Date.now();
      try {
        const stored=await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if(stored) {
          const saved=JSON.parse(stored);
          if(saved?.refreshToken) {
            const response=await fetch(
              `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
              {
                method:"POST",
                headers:{"Content-Type":"application/x-www-form-urlencoded"},
                body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(saved.refreshToken)}`
              }
            );
            const data=await response.json();
            if(!response.ok) throw new Error(data.error?.message||"Session expired");
            const restoredUser={
              email:saved.email||"",
              id:data.user_id||saved.id,
              token:data.id_token,
              refreshToken:data.refresh_token||saved.refreshToken
            };
            if(active) {
              setUser(restoredUser);
              setUsername(saved.username||saved.email?.split("@")[0]||"User");
              setEditUsername(saved.username||saved.email?.split("@")[0]||"User");
              setPage("Home");
              await AsyncStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
                ...restoredUser,username:saved.username||saved.email?.split("@")[0]||"User"
              }));
            }
          } else {
            await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }
      } catch(error) {
        console.log("SESSION RESTORE ERROR:",error.message);
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(()=>{});
      } finally {
        const remaining=2000-(Date.now()-startedAt);
        if(remaining>0) await new Promise(resolve=>setTimeout(resolve,remaining));
        if(active) setSessionLoading(false);
      }
    }
    restoreSession();
    return ()=>{active=false;};
  },[]);

  // Authentication
  async function authenticate() {
    if(isSignup&&!signupUsername.trim())
      return Alert.alert("Username required","Apna username likhein.");

    if(!email.trim()||!password.trim())
      return Alert.alert("Required","Email aur password dono likhein.");

    if(password.length<6)
      return Alert.alert("Password","Password kam az kam 6 characters ka hona chahiye.");

    setLoading(true);

    try {
      const endpoint = isSignup?"signUp":"signInWithPassword";
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            email:email.trim(),
            password,
            returnSecureToken:true
          })
        }
      );

      const data = await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Authentication failed.");

      let finalUsername = data.displayName||"";

      if(isSignup) {
        finalUsername = signupUsername.trim();
        const updateResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
          {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              idToken:data.idToken,
              displayName:finalUsername,
              returnSecureToken:true
            })
          }
        );

        const updateData = await updateResponse.json();
        if(!updateResponse.ok)
          throw new Error(updateData.error?.message||"Username save nahi hua.");
      }

      if(!finalUsername) finalUsername=data.email?.split("@")[0]||"User";

      const signedInUser={
        email:data.email,
        id:data.localId,
        token:data.idToken,
        refreshToken:data.refreshToken
      };
      try {
        await AsyncStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
          ...signedInUser,username:finalUsername
        }));
      } catch(storageError) {
        console.log("SESSION SAVE ERROR:",storageError.message);
      }
      setUser(signedInUser);
      setUsername(finalUsername);
      setEditUsername(finalUsername);
      setEditBio(bio);
      setPage("Home");
      setIsSignup(false);

      Alert.alert("Welcome!",isSignup?"Account create ho gaya.":"Login successful.");
    } catch(error) {
      let message=error.message||"Dobara try karein.";
      if(message.includes("EMAIL_EXISTS")) message="Yeh email pehle se registered hai.";
      else if(message.includes("INVALID_LOGIN_CREDENTIALS")||message.includes("EMAIL_NOT_FOUND")||message.includes("INVALID_PASSWORD")) message="Email ya password ghalat hai.";
      else if(message.includes("WEAK_PASSWORD")) message="Password kam az kam 6 characters ka rakhein.";
      else if(message.includes("INVALID_EMAIL")) message="Email address check karein.";
      Alert.alert("Error",message);
    } finally {
      setLoading(false);
    }
  }

  // Load own profile and other creators' public profile data
  async function loadMyProfile() {
    if(!user?.token) return;

    try {
      const response=await fetch(
        `${DATABASE_URL}/users/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data=await response.json();

      if(!response.ok) throw new Error(data?.error||"Profile load nahi hua.");

      if(data&&typeof data==="object") {
        setUsername(data.username||username);
        setBio(data.bio||"Welcome to my Gen Video Live profile! 👑");
        setLocation(data.location||"");
        setProfileImage(data.profileImage||"");
        setCoverImage(data.coverImage||"");
        setEditUsername(data.username||username);
        setEditBio(data.bio||"Welcome to my Gen Video Live profile! 👑");
        setEditLocation(data.location||"");
        setEditProfileImage(data.profileImage||"");
        setEditCoverImage(data.coverImage||"");
        setYoutubeLink(data.youtubeLink||"");
        setEditYoutubeLink(data.youtubeLink||"");
        setUserProfiles(old=>({...old,[user.id]:data}));
        await AsyncStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
          ...user,username:data.username||username||user.email?.split("@")[0]||"User"
        })).catch(error=>console.log("PROFILE SESSION SYNC ERROR:",error.message));
      } else {
        setEditUsername(username);
        setEditBio(bio);
        setEditLocation("");
        setEditProfileImage("");
        setEditCoverImage("");
        setYoutubeLink("");
        setEditYoutubeLink("");
      }
    } catch(error) {
      console.log("PROFILE LOAD ERROR:",error.message);
    }
  }

  // Count one view per signed-in account for each video.
  async function recordPostView(post) {
    if(!user?.token||!user?.id||!post?.id||viewedPostIdsRef.current[post.id]) return;
    viewedPostIdsRef.current[post.id]=true;
    try {
      const viewUrl=`${DATABASE_URL}/posts/${post.id}/viewsByUser/${user.id}.json?auth=${encodeURIComponent(user.token)}`;
      const check=await fetch(viewUrl);
      const alreadyViewed=await check.json();
      if(!check.ok) throw new Error("View check failed");
      if(alreadyViewed===true) return;
      const response=await fetch(viewUrl,{method:"PUT",headers:{"Content-Type":"application/json"},body:"true"});
      if(!response.ok) throw new Error("View save failed");
      setPosts(old=>old.map(item=>item.id===post.id?{...item,viewsByUser:{...(item.viewsByUser||{}),[user.id]:true}}:item));
      setPlayingPost(old=>old?.id===post.id?{...old,viewsByUser:{...(old.viewsByUser||{}),[user.id]:true}}:old);
    } catch(error) {
      delete viewedPostIdsRef.current[post.id];
      console.log("POST VIEW ERROR:",error.message);
    }
  }

  // Load posts from Firebase
  async function loadPosts() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/posts.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();

      if(!response.ok) {
        throw new Error(typeof data==="string"?data:(data?.error||"Posts load nahi hue."));
      }

      const list = data&&typeof data==="object"
        ? Object.entries(data)
            .filter(([id,post])=>post&&typeof post==="object")
            .map(([id,post])=>({id,...post,ownerId:post.ownerId||post.userId||post.uid||""}))
            .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
        : [];

      setPosts(list);

      // Load each post owner's profile by UID. A broad /users.json read can be
      // blocked by Firebase rules even when individual public profile reads work.
      const ownerIds=[...new Set(list.map(post=>post.ownerId).filter(Boolean))];
      const profileResults=await Promise.all(ownerIds.map(async ownerId=>{
        try {
          const profileResponse=await fetch(
            `${DATABASE_URL}/users/${encodeURIComponent(ownerId)}.json?auth=${encodeURIComponent(user.token)}`
          );
          const profileData=await profileResponse.json();
          if(profileResponse.ok&&profileData&&typeof profileData==="object") {
            return [ownerId,profileData];
          }
        } catch(profileError) {
          console.log("CREATOR PROFILE LOAD ERROR:",ownerId,profileError.message);
        }
        return null;
      }));
      const profilesByOwner={};
      profileResults.forEach(entry=>{
        if(entry) profilesByOwner[entry[0]]=entry[1];
      });
      if(Object.keys(profilesByOwner).length) {
        setUserProfiles(old=>({...old,...profilesByOwner}));
      }

      console.log("POSTS LOADED:",list.length,"CREATOR PROFILES:",Object.keys(profilesByOwner).length);
    } catch(error) {
      console.log("POST LOAD ERROR:",error.message);
      Alert.alert(
        "Posts load nahi hue",
        `${error.message}\n\nFirebase Database Rules check karein.`
      );
    }
  }

  async function loadLikeSave() {
    if(!user?.token) return;

    try {
      const [likeResponse,saveResponse] = await Promise.all([
        fetch(`${DATABASE_URL}/userLikes/${user.id}.json?auth=${encodeURIComponent(user.token)}`),
        fetch(`${DATABASE_URL}/userSaves/${user.id}.json?auth=${encodeURIComponent(user.token)}`)
      ]);

      const likeData = await likeResponse.json();
      const saveData = await saveResponse.json();

      if(!likeResponse.ok) throw new Error("Likes load nahi hue.");
      if(!saveResponse.ok) throw new Error("Saved videos load nahi huin.");

      setLiked(likeData&&typeof likeData==="object"?likeData:{});
      setSaved(saveData&&typeof saveData==="object"?saveData:{});
      // Migrate this signed-in user's older Likes/Saves into the public per-post
      // engagement index without making the private userSaves list readable.
      const migrationPatch={};
      Object.entries(likeData||{}).forEach(([postId,value])=>{if(value)migrationPatch[`postEngagement/${postId}/likes/${user.id}`]=true;});
      Object.entries(saveData||{}).forEach(([postId,value])=>{if(value)migrationPatch[`postEngagement/${postId}/saves/${user.id}`]=true;});
      if(Object.keys(migrationPatch).length) {
        const migrationResponse=await fetch(`${DATABASE_URL}/.json?auth=${encodeURIComponent(user.token)}`,{
          method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(migrationPatch)
        });
        if(!migrationResponse.ok) throw new Error("Purane Likes/Saves counts migrate nahi hue. Firebase Rules update required.");
        await loadEngagementCounts();
      }
    } catch(error) {
      console.log("LIKE/SAVE LOAD ERROR:",error.message);
    }
  }

  async function loadEngagementCounts() {
    if(!user?.token) return;

    try {
      const [commentsResponse,engagementResponse]=await Promise.all([
        fetch(`${DATABASE_URL}/comments.json?auth=${encodeURIComponent(user.token)}`),
        fetch(`${DATABASE_URL}/postEngagement.json?auth=${encodeURIComponent(user.token)}`)
      ]);
      const commentsData=await commentsResponse.json();
      const engagementData=await engagementResponse.json();
      if(!commentsResponse.ok) throw new Error("Comment counts load nahi hue.");
      if(!engagementResponse.ok) throw new Error("Public engagement counts load nahi hue. Firebase Rules update required.");

      const nextCommentCounts={};
      if(commentsData&&typeof commentsData==="object") {
        Object.entries(commentsData).forEach(([postId,items])=>{
          nextCommentCounts[postId]=items&&typeof items==="object"
            ? Object.values(items).filter(item=>item&&typeof item==="object").length
            : 0;
        });
      }

      const nextSaveCounts={},nextLikeCounts={};
      if(engagementData&&typeof engagementData==="object") {
        Object.entries(engagementData).forEach(([postId,activity])=>{
          const likes=activity?.likes,saves=activity?.saves;
          nextLikeCounts[postId]=likes&&typeof likes==="object"?Object.keys(likes).length:0;
          nextSaveCounts[postId]=saves&&typeof saves==="object"?Object.keys(saves).length:0;
        });
      }
      setCommentCounts(nextCommentCounts);
      setSaveCounts(nextSaveCounts);
      setLikeCounts(nextLikeCounts);
    } catch(error) {
      console.log("ENGAGEMENT COUNTS LOAD ERROR:",error.message);
    }
  }

  async function loadSocialRecords() {
    if(!user?.token) return;
    try {
      const paths=["reposts.json","shares.json",`userReposts/${user.id}.json`,`userChats/${user.id}.json`,`messageRequests/${user.id}.json`];
      const responses=await Promise.all(paths.map(path=>fetch(`${DATABASE_URL}/${path}?auth=${encodeURIComponent(user.token)}`)));
      const data=await Promise.all(responses.map(response=>response.json()));
      if(responses.some(response=>!response.ok)) throw new Error("Social records load nahi hue. Firebase Rules update required.");
      const [repostsData,sharesData,myRepostsData,chatsData,requestsData]=data;
      const nextRepostCounts={},nextShareCounts={};
      Object.entries(repostsData||{}).forEach(([id,items])=>nextRepostCounts[id]=items&&typeof items==="object"?Object.keys(items).length:0);
      Object.entries(sharesData||{}).forEach(([id,items])=>nextShareCounts[id]=items&&typeof items==="object"?Object.keys(items).length:0);
      setReposts(repostsData&&typeof repostsData==="object"?repostsData:{});
      setMyReposts(myRepostsData&&typeof myRepostsData==="object"?myRepostsData:{});
      setRepostCounts(nextRepostCounts);setShareCounts(nextShareCounts);
      setUserChats(chatsData&&typeof chatsData==="object"?chatsData:{});
      setMessageRequests(requestsData&&typeof requestsData==="object"?requestsData:{});
    } catch(error){console.log("SOCIAL RECORDS LOAD ERROR:",error.message);}
  }

  async function searchMessageRecipients(value) {
    setRecipientQuery(value);
    const q=String(value||"").trim().replace(/^@/,"").toLowerCase();
    if(!q||!user?.token){setRecipientResults([]);return;}
    setRecipientLoading(true);
    try {
      const response=await fetch(`${DATABASE_URL}/users.json?auth=${encodeURIComponent(user.token)}`);
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||"Users search nahi ho sake.");
      setRecipientResults(Object.entries(data||{}).filter(([id,p])=>id!==user.id&&p&&String(p.username||"").replace(/^@/,"").toLowerCase().includes(q)).slice(0,25).map(([id,p])=>({id,username:p.username||"User",profileImage:p.profileImage||""})));
    } catch(error){setRecipientResults([]);Alert.alert("User search",error.message||"Users search nahi ho sake.");}
    finally{setRecipientLoading(false);}
  }

  async function acceptMessageRequest(request) {
    if(!user?.token||!request?.requesterId)return;
    try {
      const senderId=request.requesterId,chatId=[String(user.id),String(senderId)].sort().join("__"),now=Date.now();
      const mine={chatId,otherUserId:senderId,otherUsername:request.requesterUsername||"User",lastMessageType:request.type||"text",lastMessageText:request.text||"",lastMessageAt:request.createdAt||now,lastMessageSenderId:senderId};
      const theirs={...mine,otherUserId:user.id,otherUsername:username||"User"};
      const patch={
        [`userChats/${user.id}/${chatId}`]:mine,
        [`userChats/${senderId}/${chatId}`]:theirs,
        [`messages/${chatId}/accepted_${request.createdAt||now}`]:{...request,seen:false,acceptedAt:now},
        [`messageRequests/${user.id}/${senderId}`]:null
      };
      const response=await fetch(`${DATABASE_URL}/.json?auth=${encodeURIComponent(user.token)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});
      if(!response.ok) {const errorData=await response.json();throw new Error(errorData?.error||"Request accept nahi hui. Firebase Rules check karein.");}
      setMessageRequests(old=>{const next={...old};delete next[senderId];return next;});
      setUserChats(old=>({...old,[chatId]:mine}));
      Alert.alert("Accepted","Ab ye chat Main Inbox mein aa gayi hai.");
    } catch(error){Alert.alert("Request error",error.message||"Request accept nahi hui.");}
  }

  async function ignoreMessageRequest(request) {
    if(!user?.token||!request?.requesterId)return;
    try {
      const response=await fetch(`${DATABASE_URL}/messageRequests/${user.id}/${request.requesterId}.json?auth=${encodeURIComponent(user.token)}`,{method:"DELETE"});
      if(!response.ok)throw new Error("Request remove nahi hui. Firebase Rules check karein.");
      setMessageRequests(old=>{const next={...old};delete next[request.requesterId];return next;});
    } catch(error){Alert.alert("Request error",error.message||"Request remove nahi hui.");}
  }

  async function openInboxConversation(chat) {
    setSelectedChat(chat);setConversationMessages([]);setConversationLoading(true);
    try {
      const response=await fetch(`${DATABASE_URL}/messages/${encodeURIComponent(chat.chatId)}.json?auth=${encodeURIComponent(user.token)}`);
      const data=await response.json();if(!response.ok)throw new Error(data?.error||"Messages load nahi hue.");
      setConversationMessages(data&&typeof data==="object"?Object.entries(data).map(([id,item])=>({id,...item})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)):[]);
    } catch(error){Alert.alert("Inbox",error.message||"Messages load nahi hue.");}
    finally{setConversationLoading(false);}
  }

  async function sendVideoToRecipient(recipient) {
    const post=shareTargetPost;if(!post||!recipient?.id||!user?.token||messageSending)return;
    setMessageSending(true);
    try {
      const chatId=[String(user.id),String(recipient.id)].sort().join("__"),now=Date.now();
      const message={type:"video",senderId:user.id,senderUsername:username||"User",recipientId:recipient.id,recipientUsername:recipient.username||"User",post:{postId:post.id,ownerId:post.ownerId||"",creator:post.creator||"Creator",caption:post.caption||"",videoUrl:post.videoUrl,thumbnailUrl:getVideoThumbnail(post)||""},text:messageText.trim(),createdAt:now,seen:false};
      const followsMeResponse=await fetch(`${DATABASE_URL}/followers/${user.id}/${recipient.id}.json?auth=${encodeURIComponent(user.token)}`);
      const followsMe=await followsMeResponse.json();
      if(!followsMeResponse.ok) throw new Error("Follow status check nahi ho saka. Firebase Rules check karein.");
      const isFollowingMe=!!followsMe;
      if(!isFollowingMe) {
        const request={...message,requesterId:user.id,requesterUsername:username||"User",recipientId:recipient.id,recipientUsername:recipient.username||"User",status:"pending",requestedAt:now};
        const requestResponse=await fetch(`${DATABASE_URL}/messageRequests/${recipient.id}/${user.id}.json?auth=${encodeURIComponent(user.token)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)});
        if(!requestResponse.ok) throw new Error("Message request save nahi hui. Firebase Rules update required.");
        const sharePath=`${DATABASE_URL}/shares/${post.id}/${user.id}.json?auth=${encodeURIComponent(user.token)}`;
        const shareCheck=await fetch(sharePath),shareExisting=await shareCheck.json();
        if(!shareCheck.ok) throw new Error("Share record check nahi ho saka.");
        const shareSave=await fetch(sharePath,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user.id,destination:"in_app",firstSharedAt:shareExisting?.firstSharedAt||now,lastSharedAt:now,shareAttempts:Number(shareExisting?.shareAttempts||0)+1})});
        if(!shareSave.ok) throw new Error("Request bheji gayi lekin Share count save nahi hua.");
        if(!shareExisting)setShareCounts(old=>({...old,[post.id]:(old[post.id]||0)+1}));
        setShareModalVisible(false);setShareTargetPost(null);setRecipientQuery("");setRecipientResults([]);setMessageText("");
        Alert.alert("Request sent","Aapki video message request bhej di gayi hai. User accept karega to chat Main mein aa jayegi.");
        return;
      }
      const mine={chatId,otherUserId:recipient.id,otherUsername:recipient.username||"User",lastMessageType:"video",lastMessageText:message.text,lastMessageAt:now,lastMessageSenderId:user.id};
      const a=await fetch(`${DATABASE_URL}/userChats/${user.id}/${encodeURIComponent(chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(mine)});
      if(!a.ok)throw new Error("Inbox conversation create nahi hui.");
      const b=await fetch(`${DATABASE_URL}/userChats/${recipient.id}/${encodeURIComponent(chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...mine,otherUserId:user.id,otherUsername:username||"User"})});
      if(!b.ok)throw new Error("Recipient Inbox update nahi hua. Rules check karein.");
      const response=await fetch(`${DATABASE_URL}/messages/${encodeURIComponent(chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(message)});
      const result=await response.json();if(!response.ok||!result?.name)throw new Error(result?.error||"Video message save nahi hua.");
      const sharePath=`${DATABASE_URL}/shares/${post.id}/${user.id}.json?auth=${encodeURIComponent(user.token)}`;
      const shareCheck=await fetch(sharePath),shareExisting=await shareCheck.json();
      if(!shareCheck.ok)throw new Error("Share record check nahi ho saka.");
      const shareSave=await fetch(sharePath,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user.id,destination:"in_app",firstSharedAt:shareExisting?.firstSharedAt||now,lastSharedAt:now,shareAttempts:Number(shareExisting?.shareAttempts||0)+1})});
      if(!shareSave.ok)throw new Error("Message bheja gaya, lekin Share count save nahi hua.");
      if(!shareExisting)setShareCounts(old=>({...old,[post.id]:(old[post.id]||0)+1}));
      setUserChats(old=>({...old,[chatId]:mine}));setShareModalVisible(false);setShareTargetPost(null);setRecipientQuery("");setRecipientResults([]);setMessageText("");
      Alert.alert("Sent","Video "+(recipient.username||"user")+" ko bhej di gayi.");
    } catch(error){Alert.alert("Send failed",error.message||"Video send nahi hui.");}
    finally{setMessageSending(false);}
  }

  async function toggleRepost(reel) {
    if(!user?.token)return Alert.alert("Login required","Pehle login karein.");
    if(!reel?.id||!reel?.videoUrl)return;
    if(reel.ownerId===user.id)return Alert.alert("Repost","Apni video ko repost nahi kar sakte.");
    const exists=!!myReposts[reel.id],record={postId:reel.id,originalOwnerId:reel.ownerId||"",reposterId:user.id,reposterUsername:username||"User",createdAt:Date.now()};
    try{
      const patch={
        [`reposts/${reel.id}/${user.id}`]:exists?null:record,
        [`userReposts/${user.id}/${reel.id}`]:exists?null:record
      };
      const response=await fetch(`${DATABASE_URL}/.json?auth=${encodeURIComponent(user.token)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)
      });
      if(!response.ok)throw new Error("Repost Firebase mein save nahi hua.");
      setMyReposts(old=>{const n={...old};if(exists)delete n[reel.id];else n[reel.id]=record;return n;});
      setReposts(old=>{const n={...old,[reel.id]:{...(old[reel.id]||{})}};if(exists)delete n[reel.id][user.id];else n[reel.id][user.id]=record;return n;});
      setRepostCounts(old=>({...old,[reel.id]:Math.max(0,(old[reel.id]||0)+(exists?-1:1))}));
      Alert.alert(exists?"Repost removed":"Reposted",exists?"Repost hata diya gaya.":"Video followers ke feed mein share ho gayi.");
    }catch(error){Alert.alert("Repost error",error.message||"Repost nahi ho saka. Rules check karein.");}
  }

  async function loadFollowerCount() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/followers/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();
      if(!response.ok) throw new Error("Follower count load nahi hua.");
      setFollowerCount(data&&typeof data==="object"?Object.keys(data).length:0);
    } catch(error) {
      console.log("FOLLOWER ERROR:",error.message);
    }
  }

  async function loadFollowing() {
    if(!user?.token) return;

    try {
      const response = await fetch(
        `${DATABASE_URL}/following/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data = await response.json();
      if(!response.ok) throw new Error("Following load nahi hui.");
      const nextFollowing=data&&typeof data==="object"?data:{};
      setFollowing(nextFollowing);
      await loadMutualFriends(nextFollowing);
    } catch(error) {
      console.log("FOLLOWING ERROR:",error.message);
    }
  }

  async function loadMutualFriends(followingData=following) {
    if(!user?.token) return;
    try {
      const response=await fetch(
        `${DATABASE_URL}/followers/${user.id}.json?auth=${encodeURIComponent(user.token)}`
      );
      const data=await response.json();
      if(!response.ok) throw new Error("Friends list load nahi hui.");
      const followers=data&&typeof data==="object"?data:{};
      const mutualIds=Object.keys(followingData).filter(id=>!!followers[id]&&id!==user.id);
      const list=mutualIds.map(id=>({
        id,
        username:userProfiles[id]?.username||followingData[id]?.username||followers[id]?.username||"Friend",
        profileImage:userProfiles[id]?.profileImage||"",
      }));
      setMutualFriends(list);
    } catch(error) {
      console.log("FRIENDS LOAD ERROR:",error.message);
    }
  }

  async function refreshAllFeeds() {
    if(!user?.token) return;
    const nextFeedIndex=visibleReels.length>1?(activeReelIndex+1)%visibleReels.length:0;
    setRefreshing(true);
    try {
      await Promise.all([
        loadPosts(),
        loadFollowing(),
        loadFollowerCount(),
        loadLikeSave(),
        loadEngagementCounts(),
        loadSocialRecords(),
        loadMyProfile()
      ]);
      const safeNextIndex=Math.min(nextFeedIndex,Math.max(0,visibleReels.length-1));
      setActiveReelIndex(safeNextIndex);
      feedScrollRef.current?.scrollTo({y:safeNextIndex*reelHeight,animated:false});
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(()=>{
    if(user?.token) {
      loadMyProfile();
      loadPosts();
      loadFollowerCount();
      loadFollowing();
      loadLikeSave();
      loadEngagementCounts();
      loadSocialRecords();
    }
  },[user]);

  useEffect(()=>{
    setActiveReelIndex(0);
    const timer = setTimeout(()=>{
      feedScrollRef.current?.scrollTo({y:0,animated:false});
    },100);
    return ()=>clearTimeout(timer);
  },[feedTab]);

  function confirmDeletePost(post) {
    if(!post?.id || post.ownerId!==user?.id) {
      return Alert.alert("Delete unavailable","Aap sirf apni post delete kar sakte hain.");
    }

    Alert.alert(
      "Delete post?",
      "Kya aap waqai apni yeh post delete karna chahte hain? Yeh app se remove ho jayegi.",
      [
        {text:"Cancel",style:"cancel"},
        {
          text:"Delete",
          style:"destructive",
          onPress:async()=>{
            try {
              const response=await fetch(
                `${DATABASE_URL}/posts/${post.id}.json?auth=${encodeURIComponent(user.token)}`,
                {method:"DELETE"}
              );
              const result=await response.json().catch(()=>null);
              if(!response.ok) throw new Error(result?.error||"Post delete nahi hui.");
              setPosts(old=>old.filter(item=>item.id!==post.id));
              setLiked(old=>{const next={...old};delete next[post.id];return next;});
              setSaved(old=>{const next={...old};delete next[post.id];return next;});
              Alert.alert("Deleted","Aapki post app se delete ho gayi hai.");
            } catch(error) {
              Alert.alert("Delete failed",error.message||"Post delete nahi ho saki. Dobara try karein.");
            }
          }
        }
      ]
    );
  }

  async function toggleLike(id) {
    const wasLiked=!!liked[id];
    const nextValue=!wasLiked;

    setLiked(old=>({...old,[id]:nextValue}));
    setLikeCounts(old=>({...old,[id]:Math.max(0,(old[id]||0)+(nextValue?1:-1))}));

    if(id.startsWith("demo")) return;
    if(!user?.token) return;

    try {
      const url=`${DATABASE_URL}/userLikes/${user.id}/${id}.json?auth=${encodeURIComponent(user.token)}`;

      const patch={
        [`userLikes/${user.id}/${id}`]:nextValue?true:null,
        [`postEngagement/${id}/likes/${user.id}`]:nextValue?true:null
      };
      const response=await fetch(`${DATABASE_URL}/.json?auth=${encodeURIComponent(user.token)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)
      });
      if(!response.ok) throw new Error("Like save nahi hua.");
    } catch(error) {
      setLiked(old=>({...old,[id]:wasLiked}));
      setLikeCounts(old=>({...old,[id]:Math.max(0,(old[id]||0)+(wasLiked?1:-1))}));
      Alert.alert("Like Error","Like Firebase mein save nahi hua. Database Rules check karein.");
    }
  }

  async function toggleSave(id) {
    const wasSaved=!!saved[id];
    const nextValue=!wasSaved;

    setSaved(old=>({...old,[id]:nextValue}));
    if(!id.startsWith("demo")) {
      setSaveCounts(old=>({...old,[id]:Math.max(0,(old[id]||0)+(nextValue?1:-1))}));
    }

    if(id.startsWith("demo")) return;
    if(!user?.token) return;

    try {
      const url=`${DATABASE_URL}/userSaves/${user.id}/${id}.json?auth=${encodeURIComponent(user.token)}`;

      const patch={
        [`userSaves/${user.id}/${id}`]:nextValue?true:null,
        [`postEngagement/${id}/saves/${user.id}`]:nextValue?true:null
      };
      const response=await fetch(`${DATABASE_URL}/.json?auth=${encodeURIComponent(user.token)}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)
      });
      if(!response.ok) throw new Error("Save nahi hua.");
    } catch(error) {
      setSaved(old=>({...old,[id]:wasSaved}));
      setSaveCounts(old=>({...old,[id]:Math.max(0,(old[id]||0)+(wasSaved?1:-1))}));
      Alert.alert("Save Error","Video save nahi hui. Database Rules check karein.");
    }
  }

  async function toggleFollow(reel) {
    if(!user?.token) return Alert.alert("Login required","Pehle login karein.");
    if(!reel.ownerId) return Alert.alert("Follow unavailable","Yeh demo creator connected nahi hai.");
    if(reel.ownerId===user.id) return Alert.alert("Follow","Aap apne account ko follow nahi kar sakte.");

    const creatorId=reel.ownerId;
    const wasFollowing=!!following[creatorId];

    try {
      const followerPath=`${DATABASE_URL}/followers/${creatorId}/${user.id}.json?auth=${encodeURIComponent(user.token)}`;
      const followingPath=`${DATABASE_URL}/following/${user.id}/${creatorId}.json?auth=${encodeURIComponent(user.token)}`;

      if(wasFollowing) {
        const a=await fetch(followerPath,{method:"DELETE"});
        const b=await fetch(followingPath,{method:"DELETE"});
        if(!a.ok||!b.ok) throw new Error("Unfollow failed");

        setFollowing(old=>{
          const updated={...old};
          delete updated[creatorId];
          return updated;
        });
      } else {
        const record={username,createdAt:Date.now()};
        const a=await fetch(followerPath,{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(record)
        });
        const b=await fetch(followingPath,{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({username:reel.creator||"Creator",createdAt:Date.now()})
        });

        if(!a.ok||!b.ok) throw new Error("Follow failed");
        setFollowing(old=>({...old,[creatorId]:record}));
      }

      await loadFollowerCount();
    } catch(error) {
      Alert.alert("Follow Error","Firebase Database rules check karein.");
      await loadFollowing();
    }
  }

  async function chooseVideoFromGallery(addToTimeline=false) {
    setAddingToTimeline(!!addToTimeline);
    try {
      setGalleryLoading(true);
      setGallerySelectedIds(selectedCreateMedia.map(item=>item.id||item.uri));
      setCreateStep("gallery");
      const permission=await MediaLibrary.requestPermissionsAsync(false,["photo","video"]);
      if(!permission.granted) { setCreateStep("camera"); return Alert.alert("Permission","Gallery access allow karein."); }
      const result=await MediaLibrary.getAssetsAsync({first:150,mediaType:["photo","video"],sortBy:[["creationTime",false]]});
      setGalleryAssets(result.assets||[]);
    } catch(error) {
      setCreateStep("camera");
      Alert.alert("Gallery Error",error.message||"Gallery load nahi ho saki.");
    } finally { setGalleryLoading(false); }
  }

  function toggleGalleryAsset(asset) {
    const key=asset.id||asset.uri;
    setGallerySelectedIds(old=>{
      if(old.includes(key)) return old.filter(id=>id!==key);
      if(old.length>=15) { Alert.alert("Selection limit","Ek baar mein zyada se zyada 15 photos/videos select kar sakte hain."); return old; }
      return [...old,key];
    });
  }

  async function openSystemFileManager() {
    try {
      const result=await DocumentPicker.getDocumentAsync({
        type:["image/*","video/*"], multiple:true, copyToCacheDirectory:true
      });
      if(result.canceled||!result.assets?.length) return;
      const picked=result.assets.map((asset,index)=>{
        const mime=asset.mimeType||"";
        const isVideo=mime.startsWith("video/");
        return {id:asset.name+"-"+index+"-"+Date.now(),uri:asset.uri,originalUri:asset.uri,type:isVideo?"video":"image",mimeType:mime||(isVideo?"video/mp4":"image/jpeg"),fileName:asset.name||"Selected media",duration:asset.duration||0};
      });
      setSelectedCreateMedia(old=>[...old,...picked.filter(item=>!old.some(existing=>existing.uri===item.uri))].slice(0,15));
      setCreatePhotos(old=>[...old,...picked.filter(item=>item.type==="image"&&!old.some(existing=>existing.uri===item.uri))]);
      const firstVideo=picked.find(item=>item.type==="video");
      if(firstVideo) setSelectedVideo(old=>old||firstVideo);
      setCreateStep("gallery");
      Alert.alert("Files selected",picked.length+" file(s) File Manager se add ho gayi hain.");
    } catch(error) {
      Alert.alert("File Manager",error.message||"File Manager open nahi ho saka.");
    }
  }

  async function continueFromGallery() {
    const selectedAssets=gallerySelectedIds.map(id=>galleryAssets.find(asset=>(asset.id||asset.uri)===id)).filter(Boolean);
    if(!selectedAssets.length) return Alert.alert("Select media","Pehle gallery se photo ya video select karein.");
    try {
      const picked=await Promise.all(selectedAssets.map(async asset=>{
        let resolvedUri=asset.uri;
        try {
          const info=await MediaLibrary.getAssetInfoAsync(asset,{shouldDownloadFromNetwork:true});
          resolvedUri=info?.localUri||info?.uri||asset.uri;
        } catch(error) {
          console.log("MEDIA LOCAL URI FALLBACK:",error?.message||error);
        }
        return {
          id:asset.id,uri:resolvedUri,originalUri:asset.uri,type:asset.mediaType==="video"?"video":"image",
          mimeType:asset.mediaType==="video"?"video/mp4":"image/jpeg",fileName:asset.filename,duration:asset.duration
        };
      }));
      const videos=picked.filter(asset=>asset.type==="video"),photos=picked.filter(asset=>asset.type==="image");
      if(addingToTimeline) {
        setSelectedCreateMedia(old=>{const merged=[...old,...picked.filter(item=>!old.some(existing=>existing.uri===item.uri||existing.id===item.id))];setSelectedTimelineIndex(Math.max(0,merged.length-1));return merged.slice(0,15);});
        setCreatePhotos(old=>[...old,...photos.filter(item=>!old.some(existing=>existing.uri===item.uri||existing.id===item.id))]);
        if(videos.length)setSelectedVideo(old=>old||videos[0]);
        setAddingToTimeline(false);
        setCreateStep("selected");
      } else {
        setSelectedCreateMedia(picked); setCreatePhotos(photos); setSelectedVideo(videos[0]||null); setSelectedTimelineIndex(0); setAddingToTimeline(false); setCreateStep("selected");
      }
    } catch(error) {
      Alert.alert("Media preview",error?.message||"Selected media open nahi ho saka.");
    }
  }

  async function recordVideo() {
    if(!cameraPermissionGranted) {
      try {
        const result=await Camera.requestCameraPermissionsAsync();
        setCameraPermissionGranted(!!result.granted);
        if(!result.granted) return Alert.alert("Permission","Camera permission allow karein.");
      } catch(error) {
        return Alert.alert("Camera Error",error.message||"Camera permission nahi mili.");
      }
    }
    if(!microphonePermissionGranted) {
      try {
        const result=await Camera.requestMicrophonePermissionsAsync();
        setMicrophonePermissionGranted(!!result.granted);
        if(!result.granted) return Alert.alert("Permission","Video ki awaaz record karne ke liye microphone permission allow karein.");
      } catch(error) {
        return Alert.alert("Microphone Permission",error.message||"Microphone permission nahi mili.");
      }
    }
    if(!cameraRef.current) return Alert.alert("Camera","Camera abhi ready nahi hai. Ek second baad dobara try karein.");
    try {
      setIsRecording(true);
      const result=await cameraRef.current.recordAsync({maxDuration:180});
      setIsRecording(false);
      if(result?.uri) {
        const recorded={uri:result.uri,type:"video",mimeType:"video/mp4",fileName:"gen-live-recording-"+Date.now()+".mp4"};
        setSelectedVideo(recorded);
        setSelectedCreateMedia(old=>[recorded,...old.filter(item=>item.uri!==recorded.uri)].slice(0,15));
        setCreateStep("selected");
      }
    } catch(error) {
      setIsRecording(false);
      Alert.alert("Recording Error",error.message||"Video record nahi ho saki.");
    }
  }

  function stopCameraRecording() {
    try { cameraRef.current?.stopRecording(); }
    catch(error) { Alert.alert("Recording Error",error.message||"Recording stop nahi hui."); }
  }

  // Profile photo picker
  async function chooseProfileImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Gallery permission allow karein.");

      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],
        allowsEditing:true,
        aspect:[1,1],
        quality:0.8
      });

      if(!result.canceled&&result.assets?.length) {
        setEditProfileImage(result.assets[0].uri);
      }
    } catch(error) {
      Alert.alert("Image Picker Error",error.message||"Profile image select nahi hui.");
    }
  }

  // Cover photo picker
  async function chooseCoverImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)
        return Alert.alert("Permission","Gallery permission allow karein.");

      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"],
        allowsEditing:true,
        aspect:[16,9],
        quality:0.8
      });

      if(!result.canceled&&result.assets?.length) {
        setEditCoverImage(result.assets[0].uri);
      }
    } catch(error) {
      Alert.alert("Image Picker Error",error.message||"Cover image select nahi hui.");
    }
  }

  async function choosePostCoverImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[16,9],quality:0.85});
      if(!result.canceled && result.assets?.length) setPostCoverImage(result.assets[0].uri);
    } catch(error) { Alert.alert("Cover Error",error.message||"Cover select nahi hui."); }
  }

  async function chooseAllMediaForPost() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images","videos"], allowsMultipleSelection:true,
        selectionLimit:10, quality:1
      });
      if(!result.canceled && result.assets?.length) {
        const videos=result.assets.filter(asset=>asset.type==="video" || asset.mimeType?.startsWith("video/"));
        const photos=result.assets.filter(asset=>asset.type==="image" || asset.mimeType?.startsWith("image/"));
        if(videos.length) setSelectedVideo(videos[0]);
        setCreatePhotos(photos);
        if(videos.length>1) Alert.alert("Media selected",`${videos.length} videos aur ${photos.length} photos select huin. Upload ke liye pehli video use hogi.`);
      }
    } catch(error) { Alert.alert("Gallery Error",error.message||"Media select nahi ho saka."); }
  }

  async function choosePhotosForPost() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:["images"], allowsMultipleSelection:true, quality:0.9, selectionLimit:10
      });
      if(!result.canceled && result.assets?.length) setCreatePhotos(result.assets);
    } catch(error) { Alert.alert("Gallery Error",error.message||"Photos select nahi ho sakin."); }
  }

  function nextCreateStep(step) { setCreateStep(step); }

  function getVideoFileName(asset) {
    if(asset.fileName) return asset.fileName;
    const extension=asset.mimeType?.includes("quicktime")?"mov":"mp4";
    return `gen-video-${Date.now()}.${extension}`;
  }

  // Cloudinary video upload
  function uploadToCloudinary(formData) {
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();

      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`
      );

      xhr.timeout=10*60*1000;

      xhr.upload.onprogress=(event)=>{
        if(event.lengthComputable) {
          const percent=Math.round((event.loaded/event.total)*100);
          setUploadProgress(percent);
        }
      };

      xhr.onload=()=>{
        let data={};
        try {
          data=JSON.parse(xhr.responseText||"{}");
        } catch(e) {
          reject(new Error("Cloudinary ka response samajh nahi aaya."));
          return;
        }

        if(xhr.status>=200&&xhr.status<300&&data.secure_url) {
          resolve(data);
        } else {
          reject(new Error(
            data?.error?.message||`Cloudinary upload failed. Status: ${xhr.status}`
          ));
        }
      };

      xhr.onerror=()=>reject(new Error("Internet connection error. Upload complete nahi hui."));
      xhr.ontimeout=()=>reject(new Error("Upload mein bohat waqt lag gaya. Dobara try karein."));
      xhr.onabort=()=>reject(new Error("Upload cancel ho gayi."));
      xhr.send(formData);
    });
  }

  // Cloudinary image upload for profile and cover photos
  async function uploadMagicMediaToCloudinary(uri,mediaType) {
    const isVideo=mediaType==="Video";
    const endpoint=isVideo?"video":"image";
    const formData=new FormData();
    formData.append("file",{uri,name:"magic-"+Date.now()+(isVideo?".mp4":".jpg"),type:isVideo?"video/mp4":"image/jpeg"});
    formData.append("upload_preset",UPLOAD_PRESET);
    const response=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD_NAME+"/"+endpoint+"/upload",{method:"POST",body:formData});
    const data=await response.json();
    if(!response.ok||!data.secure_url) throw new Error(data?.error?.message||"Media upload nahi ho saki.");
    return data.secure_url;
  }

  async function uploadImageToCloudinary(uri,label) {
    const formData=new FormData();

    formData.append("file",{
      uri,
      name:`${label}-${Date.now()}.jpg`,
      type:"image/jpeg"
    });

    formData.append("upload_preset",UPLOAD_PRESET);

    const response=await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method:"POST",
        body:formData
      }
    );

    const data=await response.json();

    if(!response.ok||!data.secure_url) {
      throw new Error(data?.error?.message||"Image Cloudinary par upload nahi hui.");
    }

    return data.secure_url;
  }

  function saveCurrentDraft() {
    if(!selectedVideo?.uri && !caption.trim() && !createPhotos.length) {
      return Alert.alert("Empty Draft","Pehle video, photos ya caption add karein.");
    }
    const draft={
      id:`draft-${Date.now()}`, video:selectedVideo, caption, privacy, photos:createPhotos,
      cover:postCoverImage, hashtags:postHashtags, mention:postMention,
      postLocation, link:postLink, sound:selectedSound, savedAt:Date.now()
    };
    setDrafts(old=>[draft,...old]);
    Alert.alert("Draft saved","Draft is app ki current session mein save ho gaya hai. App band/reload karne par yeh draft nahi rahega.");
    setCreateStep("camera");
  }

  function openDrafts() {
    if(!drafts.length) return Alert.alert("Drafts","Abhi koi draft save nahi hai.");
    Alert.alert("Your Drafts",`${drafts.length} draft(s) saved in this session.`,[
      ...drafts.slice(0,4).map((draft,index)=>({
        text:`${index+1}. ${draft.caption?.trim()?.slice(0,24)||draft.video?.fileName||"Untitled draft"}`,
        onPress:()=>{
          setSelectedVideo(draft.video||null); setCaption(draft.caption||"");
          setPrivacy(draft.privacy||"Public"); setCreatePhotos(draft.photos||[]);
          setPostCoverImage(draft.cover||null); setPostHashtags(draft.hashtags||"");
          setPostMention(draft.mention||""); setPostLocation(draft.postLocation||"");
          setPostLink(draft.link||""); setSelectedSound(draft.sound||"");
          setCreateStep("post");
        }
      })),
      {text:"Close",style:"cancel"}
    ]);
  }

  async function uploadVideoPost() {
    if(!user?.token) return Alert.alert("Login required","Pehle login karein.");
    if(!selectedVideo?.uri && !createPhotos.length) return Alert.alert("Media required","Pehle kam az kam ek photo ya video select karein.");
    if(!caption.trim()) return Alert.alert("Caption required","Apni post ka caption likhein.");
    if(uploading) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStage(selectedVideo?.uri?"Video aur photos upload shuru ho rahe hain...":"Photos upload shuru ho rahi hain...");

    let cloudinaryUploaded=false;

    try {
      let cloudData=null;
      if(selectedVideo?.uri) {
      const formData=new FormData();
      let videoUploadUri=selectedVideo.uri;
      if(selectedSound && soundSourceVideoUrl) {
        setUploadStage("Selected sound aur original video ki awaaz mix ho rahi hain...");
        if(!MediaEngine.isAvailable()) throw new Error("Audio mixing module native APK mein available nahi hai. Naya Android build zaroori hai.");
        const sourceVideoPath=`${FileSystem.cacheDirectory}sound-source-${Date.now()}.mp4`;
        const sourceDownload=await FileSystem.downloadAsync(soundSourceVideoUrl,sourceVideoPath);
        if(!sourceDownload?.uri) throw new Error("Selected sound download nahi ho saka.");
        const extractedAudioPath=`${FileSystem.cacheDirectory}selected-sound-${Date.now()}.m4a`;
        await MediaEngine.extractAudio(sourceDownload.uri,extractedAudioPath);
        const mixedOutputPath=`${FileSystem.cacheDirectory}gen-live-mixed-${Date.now()}.mp4`;
        const mixedResult=await MediaEngine.exportComposition({
          videoPath:selectedVideo.uri,
          outputPath:mixedOutputPath,
          duration:Number(selectedVideo.duration)||undefined,
          musicPath:extractedAudioPath,
          musicVolume:Math.max(0,Math.min(100,selectedSoundVolume))/100,
          originalVolume:Math.max(0,Math.min(100,originalVideoVolume))/100,
          quality:"high"
        });
        if(!mixedResult) throw new Error("Dono awaazon wali video tayyar nahi ho saki.");
        videoUploadUri=mixedResult;
      }

      formData.append("file",{
        uri:videoUploadUri,
        name:videoUploadUri===selectedVideo.uri?getVideoFileName(selectedVideo):`gen-live-mixed-${Date.now()}.mp4`,
        type:videoUploadUri===selectedVideo.uri?(selectedVideo.mimeType||"video/mp4"):"video/mp4"
      });

      formData.append("upload_preset",UPLOAD_PRESET);

      setUploadStage("Video Cloudinary par upload ho rahi hai...");

      cloudData=await uploadToCloudinary(formData);
      cloudinaryUploaded=true;
      }

      const photoUrls=[];
      for(let i=0;i<createPhotos.length;i++) {
        const photo=createPhotos[i];
        if(!photo?.uri) continue;
        setUploadStage("Photo "+(i+1)+"/"+createPhotos.length+" Cloudinary par upload ho rahi hai...");
        photoUrls.push(await uploadImageToCloudinary(photo.uri,"post-photo-"+(i+1)));
        setUploadProgress(Math.round(((i+1)/(createPhotos.length+(selectedVideo?.uri?1:0)))*100));
      }
      setUploadProgress(100);
      setUploadStage("Media upload ho gayi! Ab post save ho rahi hai...");

      let finalCoverUrl=postCoverImage||"";
      if(finalCoverUrl && !finalCoverUrl.startsWith("http")) {
        setUploadStage("Cover image upload ho rahi hai...");
        finalCoverUrl=await uploadImageToCloudinary(finalCoverUrl,"post-cover");
      }

      const postData={
        ownerId:user.id,
        userId:user.id,
        creator:username,
        avatarUrl:profileImage||"",
        location:location||"",
        caption:caption.trim(),
        privacy,
        videoUrl:cloudData?.secure_url||"",
        photoUrls,
        coverUrl:finalCoverUrl,
        cloudinaryPublicId:cloudData?.public_id||"",
        resourceType:cloudData?.resource_type||(photoUrls.length?"image":"video"),
        format:cloudData?.format||"",
        duration:cloudData?.duration||null,
        music:selectedSound||"Original Sound",
        soundSourcePostId:selectedSound?soundSourcePostId:"",
        soundCreator:selectedSound?soundCreator:"",
        selectedSoundVolume:selectedSound?selectedSoundVolume:0,
        originalVideoVolume:selectedSound?originalVideoVolume:100,
        hashtags:postHashtags.trim(),
        mention:postMention.trim(),
        postLocation:postLocation.trim(),
        link:postLink.trim(),
        allowComments,
        allowReuse,
        videoLanguage,
        aiGenerated,
        createdAt:Date.now()
      };

      const firebaseResponse=await fetch(
        `${DATABASE_URL}/posts.json?auth=${encodeURIComponent(user.token)}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(postData)
        }
      );

      const firebaseData=await firebaseResponse.json();

      if(!firebaseResponse.ok||!firebaseData.name) {
        throw new Error(firebaseData?.error||"Firebase post save nahi kar saka. Database rules check karein.");
      }

      const newPost={id:firebaseData.name,...postData};

      setPosts(old=>[newPost,...old.filter(post=>post.id!==newPost.id)]);

      setSelectedVideo(null);
      setSelectedCreateMedia([]);
      setGallerySelectedIds([]);
      setCaption("");
      setPrivacy("Public");
      setCreateStep("camera");
      setCreatePhotos([]);
      setPostCoverImage(null); setPostHashtags(""); setPostMention(""); setPostLocation(""); setPostLink("");
      setSelectedSound("");
      setSoundSourceVideoUrl("");
      setSoundSourcePostId("");
      setSelectedSoundVolume(70);
      setOriginalVideoVolume(70);
      setUploadProgress(100);
      setUploadStage("Upload complete!");

      await loadPosts();

      Alert.alert(
        "🎉 Upload Successful!",
        "Mubarak ho! Aapki photo/video post publish ho gayi hai.",
        [
          {
            text:"View My Post",
            onPress:()=>{
              setProfileTab(postData.privacy==="Private"?"Private":"Videos");
              setPage("Profile");
              loadPosts();
            }
          },
          {
            text:"OK",
            onPress:()=>{
              setPage("Home");
              setFeedTab("For You");
            }
          }
        ]
      );

    } catch(error) {
      console.log("UPLOAD ERROR:",error);

      const extra=cloudinaryUploaded
        ? "\n\nVideo Cloudinary par upload ho chuki hai, lekin Firebase mein post save nahi hui. Database rules aur login token check karein."
        : "";

      Alert.alert(
        "❌ Upload Failed",
        (error.message||"Upload nahi ho saki.")+extra
      );
    } finally {
      setUploading(false);
      setUploadStage("");
      setUploadProgress(0);
    }
  }

  // Save profile details and images
  async function saveProfile() {
    if(!editUsername.trim())
      return Alert.alert("Username","Username khali nahi ho sakta.");
    if(!user?.token) return;

    setLoading(true);

    try {
      let finalProfileImage=editProfileImage;
      let finalCoverImage=editCoverImage;

      // Upload only newly selected local images.
      if(editProfileImage&& !editProfileImage.startsWith("http")) {
        finalProfileImage=await uploadImageToCloudinary(editProfileImage,"profile");
      }

      if(editCoverImage&& !editCoverImage.startsWith("http")) {
        finalCoverImage=await uploadImageToCloudinary(editCoverImage,"cover");
      }

      const response=await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
        {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            idToken:user.token,
            displayName:editUsername.trim(),
            returnSecureToken:true
          })
        }
      );

      const data=await response.json();
      if(!response.ok) throw new Error(data.error?.message||"Username update failed.");

      const profileData={
        username:editUsername.trim(),
        bio:editBio.trim(),
        location:editLocation.trim(),
        profileImage:finalProfileImage||"",
        coverImage:finalCoverImage||"",
        youtubeLink:editYoutubeLink.trim(),
        updatedAt:Date.now()
      };

      const profileResponse=await fetch(
        `${DATABASE_URL}/users/${user.id}.json?auth=${encodeURIComponent(data.idToken||user.token)}`,
        {
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(profileData)
        }
      );

      const profileResult=await profileResponse.json();
      if(!profileResponse.ok) {
        throw new Error(profileResult?.error||"Profile Firebase mein save nahi hua.");
      }

      setUsername(profileData.username);
      setBio(profileData.bio);
      setLocation(profileData.location);
      setProfileImage(profileData.profileImage);
      setCoverImage(profileData.coverImage);
      setYoutubeLink(profileData.youtubeLink);
      setEditProfileImage(profileData.profileImage);
      setEditCoverImage(profileData.coverImage);
      setEditYoutubeLink(profileData.youtubeLink);
      setUser(old=>({...old,token:data.idToken||old.token}));
      setUserProfiles(old=>({...old,[user.id]:profileData}));
      await AsyncStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify({
        ...user,
        token:data.idToken||user.token,
        refreshToken:data.refreshToken||user.refreshToken,
        username:profileData.username
      }));

      setPage("Profile");
      Alert.alert("Saved","Aapki profile save ho gayi hai.");
    } catch(error) {
      Alert.alert("Profile Error",error.message||"Profile save nahi hui.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    Alert.alert("Log out","Kya aap logout karna chahte hain?",[
      {text:"Cancel",style:"cancel"},
      {
        text:"Log out",
        style:"destructive",
        onPress:async()=>{
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(error=>console.log("SESSION CLEAR ERROR:",error.message));
          setUser(null);
          setEmail("");
          setPassword("");
          setSignupUsername("");
          setUsername("");
          setBio("Welcome to my Gen Video Live profile! 👑");
          setLocation("");
          setProfileImage("");
          setCoverImage("");
          setEditProfileImage("");
          setEditCoverImage("");
          setYoutubeLink("");
          setEditYoutubeLink("");
          setUserProfiles({});
          setPosts([]);
          setFollowing({});
          setFollowerCount(0);
          setLiked({});
          setSaved({});
          setSelectedVideo(null);
          setActiveReelIndex(0);
          setPage("Home");
        }
      }
    ]);
  }

  function openSound(reel) {
    setSoundReturnPage("Home");
    setSoundTitle(reel.music||"Original Sound");
    setSoundCreator(reel.creator||"Gen Video Live");
    setSoundAvatarUrl(reel.avatarUrl||"");
    setSoundSourceVideoUrl(reel.videoUrl||"");
    setSoundSourcePostId(reel.id||"");
    setPage("Sound");
  }

  function openLive() {
    if(!liveUnlocked)
      return Alert.alert("Live Locked 🔒",`Live feature 1,000 followers ke baad unlock hoga.\nAapke followers: ${followerCount}`);
    Alert.alert("Live","Live streaming abhi connect nahi hui.");
  }

  async function shareReel(reel) {
    setShareTargetPost(reel);setRecipientQuery("");setRecipientResults([]);setMessageText("");setShareModalVisible(true);
  }

  async function shareReelExternally() {
    if(!shareTargetPost)return;
    try{
      const result=await Share.share({message:`${shareTargetPost.caption||"Watch this on Gen Video Live"}\n${shareTargetPost.videoUrl||""}`});
      if(result.action===Share.sharedAction){
        const path=`${DATABASE_URL}/shares/${shareTargetPost.id}/${user.id}.json?auth=${encodeURIComponent(user.token)}`,now=Date.now();
        const check=await fetch(path),existing=await check.json();
        if(!check.ok)throw new Error("Share record check nahi ho saka.");
        const response=await fetch(path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user.id,destination:"external",firstSharedAt:existing?.firstSharedAt||now,lastSharedAt:now,shareAttempts:Number(existing?.shareAttempts||0)+1})});
        if(!response.ok)throw new Error("Share record Firebase mein save nahi hua.");
        if(!existing)setShareCounts(old=>({...old,[shareTargetPost.id]:(old[shareTargetPost.id]||0)+1}));
      }
    }catch(error){Alert.alert("Share",error.message||"Share nahi ho saka.");}
  }

  async function openComments(reel) {
    if(reel?.allowComments===false) return Alert.alert("Comments disabled","Is video par comments band hain.");
    setCommentPost(reel); setComments([]); setCommentText(""); setCommentImage(null);
    setCommentsVisible(true); setCommentsLoading(true);
    try {
      const response=await fetch(DATABASE_URL+"/comments/"+reel.id+".json?auth="+encodeURIComponent(user.token));
      const data=await response.json();
      if(!response.ok) throw new Error(data?.error||"Comments load nahi hue.");
      const list=data&&typeof data==="object" ? Object.entries(data).filter(([id,item])=>item&&typeof item==="object").map(([id,item])=>({id,...item})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)) : [];
      setComments(list);
    } catch(error) { Alert.alert("Comments",error.message||"Comments load nahi hue."); }
    finally { setCommentsLoading(false); }
  }

  async function postQuickReaction(reel,emoji) {
    if(reel?.allowComments===false) return Alert.alert("Comments disabled","Is video par comments band hain.");
    try {
      const commentData={userId:user.id,username:username||user.email?.split("@")[0]||"User",profileImage:profileImage||"",text:emoji,imageUrl:"",createdAt:Date.now()};
      const response=await fetch(DATABASE_URL+"/comments/"+reel.id+".json?auth="+encodeURIComponent(user.token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(commentData)});
      const result=await response.json();
      if(!response.ok||!result?.name) throw new Error(result?.error||"Emoji comment post nahi hua.");
      setCommentCounts(old=>({...old,[reel.id]:(old[reel.id]||0)+1}));
      if(commentsVisible&&commentPost?.id===reel.id) setComments(old=>[...old,{id:result.name,...commentData}]);
    } catch(error) { Alert.alert("Emoji comment",error.message||"Emoji comment post nahi hua."); }
  }

  async function submitComment(value) {
    const textValue=String(value===undefined?commentText:value).trim();
    if(!commentPost||(!textValue&&!commentImage)||commentSending) return;
    setCommentSending(true);
    try {
      let imageUrl="";
      if(commentImage) imageUrl=await uploadImageToCloudinary(commentImage.uri,"comment");
      const commentData={userId:user.id,username:username||user.email?.split("@")[0]||"User",profileImage:profileImage||"",text:textValue,imageUrl,createdAt:Date.now()};
      const response=await fetch(DATABASE_URL+"/comments/"+commentPost.id+".json?auth="+encodeURIComponent(user.token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(commentData)});
      const result=await response.json();
      if(!response.ok||!result?.name) throw new Error(result?.error||"Comment post nahi hua.");
      setComments(old=>[...old,{id:result.name,...commentData}]);
      setCommentCounts(old=>({...old,[commentPost.id]:(old[commentPost.id]||0)+1}));
      setCommentText(""); setCommentImage(null);
    } catch(error) { Alert.alert("Comment error",error.message||"Comment post nahi hua."); }
    finally { setCommentSending(false); }
  }

  async function chooseCommentImage() {
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) return Alert.alert("Permission","Gallery permission allow karein.");
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,quality:0.85});
      if(!result.canceled&&result.assets?.length) setCommentImage(result.assets[0]);
    } catch(error) { Alert.alert("Image",error.message||"Image select nahi hui."); }
  }

  function deleteComment(comment) {
    if(comment.userId!==user?.id) return;
    Alert.alert("Delete comment","Kya aap apna comment delete karna chahte hain?",[
      {text:"Cancel",style:"cancel"},
      {text:"Delete",style:"destructive",onPress:async()=>{
        try {
          const response=await fetch(DATABASE_URL+"/comments/"+commentPost.id+"/"+comment.id+".json?auth="+encodeURIComponent(user.token),{method:"DELETE"});
          if(!response.ok) throw new Error("Comment delete nahi hua.");
          setComments(old=>old.filter(item=>item.id!==comment.id));
          setCommentCounts(old=>({...old,[commentPost.id]:Math.max(0,(old[commentPost.id]||0)-1)}));
        } catch(error) { Alert.alert("Delete error",error.message||"Comment delete nahi hua."); }
      }}
    ]);
  }

  async function saveAppLanguage(value) {
    setAppLanguage(value);
    try {
      await AsyncStorage.setItem("genVideoLive.appLanguage.v1",value);
      const label=value==="auto"?"Automatic (device)":value;
      Alert.alert("Language Saved",label+" language preference save ho gayi. App translation aglay AI development step mein connect hogi.");
    } catch(error) {
      Alert.alert("Language Error",error.message||"Language preference save nahi hui.");
    }
  }

  function openLanguagePicker() {
    let detected="English";
    try {
      const locale=Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
      if(locale.startsWith("ur")) detected="Urdu";
      else if(locale.startsWith("hi")) detected="Hindi";
    } catch(error) {}
    Alert.alert("App Language", "Automatic detected language: "+detected+"\\nChoose how Gen Video Live should set your language.", [
      {text:"Automatic ("+detected+")",onPress:()=>saveAppLanguage("auto")},
      {text:"Urdu",onPress:()=>saveAppLanguage("Urdu")},
      {text:"English",onPress:()=>saveAppLanguage("English")},
      {text:"Hindi",onPress:()=>saveAppLanguage("Hindi")},
      {text:"Cancel",style:"cancel"}
    ]);
  }

  function showPlaceholder(title) {
    Alert.alert(title,"Yeh feature aglay development step mein add hoga.");
  }

  // Attach the correct creator's current profile image to their reels.
  const publicPosts=posts.filter(post=>post.privacy!=="Private" && isRealVideoPost(post));

  const allReels=publicPosts.map(reel=>{
    const creatorProfile=reel.ownerId?userProfiles[reel.ownerId]:null;
    const ownPhoto=reel.ownerId===user?.id?profileImage:"";

    const creatorUsername=creatorProfile?.username||(reel.ownerId===user?.id?username:reel.creator)||"Creator";
    return {
      ...reel,
      creator:String(creatorUsername).replace(/^@/,""),
      avatarUrl:creatorProfile?.profileImage||ownPhoto||reel.avatarUrl||""
    };
  });

  const repostFeedEntries=Object.entries(reposts).flatMap(([postId,users])=>{
    const original=allReels.find(item=>item.id===postId);
    if(!original||!users||typeof users!=="object")return [];
    const latestRepost=Object.values(users).filter(record=>record&&record.reposterId&&following[record.reposterId]).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
    return latestRepost?[{...original,repostedByUsername:latestRepost.reposterUsername||"User",repostedById:latestRepost.reposterId,repostedAt:latestRepost.createdAt||0}]:[];
  });
  const followingReelIds=new Set(repostFeedEntries.map(reel=>reel.id));
  const visibleReels=feedTab==="Following"
    ? [...repostFeedEntries,...allReels.filter(reel=>reel.ownerId&&following[reel.ownerId]&&!followingReelIds.has(reel.id))].sort((a,b)=>(b.repostedAt||b.createdAt||0)-(a.repostedAt||a.createdAt||0))
    : allReels;
  const activeReelId=page==="Home"?visibleReels[activeReelIndex]?.id:null;
  useEffect(()=>{
    const activePost=visibleReels.find(item=>item.id===activeReelId);
    if(activePost) recordPostView(activePost);
  },[activeReelId]);

  const myPosts=posts.filter(post=>post.ownerId===user?.id && isRealVideoPost(post));
  const myPublicPosts=myPosts.filter(post=>post.privacy!=="Private");
  const privatePosts=myPosts.filter(post=>post.privacy==="Private");
  const myRepostedPosts=Object.keys(myReposts).map(id=>{
    const original=allReels.find(post=>post.id===id);
    return original?{...original,repostedByUsername:username||"User",repostedById:user?.id}:null;
  }).filter(Boolean);

  function renderHeader() {
    return (
      <View style={[styles.header,styles.headerOverlay]}>
        <TouchableOpacity onPress={openLive} activeOpacity={0.8}><Text style={styles.logo}>👑 Gen-Live</Text></TouchableOpacity>
        <View style={styles.headerTabs}>
          {["Following","For You"].map(tab=>(
            <TouchableOpacity key={tab} onPress={()=>setFeedTab(tab)} style={styles.headerTabTouch}>
              <Text style={[styles.headerTab,feedTab===tab&&styles.headerTabActive]}>{tab}</Text>
              {feedTab===tab&&<View style={styles.tabUnderline}/>}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={()=>setPage("Explore")}>
          <Text style={styles.searchIcon}>⌕</Text>
        </TouchableOpacity>

      </View>
    );
  }

  function renderLogin() {
    return (
      <KeyboardAvoidingView style={styles.authScreen} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={0}>
        <StatusBar backgroundColor={C.bg} barStyle="light-content"/>
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollsChildToFocus={true} showsVerticalScrollIndicator={true}>
          <Image source={require("./assets/icon.png")} style={{width:116,height:116,alignSelf:"center",marginBottom:12,borderRadius:24}} resizeMode="contain"/>
          <Text style={styles.authTitle}>Gen Video Live</Text>
          <Text style={styles.authSubtitle}>Watch • Create • Connect</Text>

          <View style={styles.authCard}>
            <Text style={styles.sectionTitle}>{isSignup?"Create Account":"Welcome Back"}</Text>

            {isSignup&&(
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={C.gray}
                value={signupUsername}
                onChangeText={setSignupUsername}
                autoCapitalize="none"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={C.gray}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password (6+ characters)"
              placeholderTextColor={C.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              title={loading?"Please wait...":isSignup?"Create Account":"Login"}
              onPress={authenticate}
              disabled={loading}
            />

            {loading&&<ActivityIndicator color={C.magenta} style={{marginTop:12}}/>}

            <TouchableOpacity onPress={()=>setIsSignup(!isSignup)} style={{marginTop:22}}>
              <Text style={styles.switchText}>
                {isSignup?"Already have an account? Login":"New here? Create an account"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.smallMuted}>Urdu • English</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderHome() {
    return (
      <View style={styles.screen}>
        {renderHeader()}

        <View
          style={styles.reelScroll}
          onLayout={event=>{
            const height=event.nativeEvent.layout.height;
            if(height>0&&Math.abs(height-feedHeight)>1) {
              setFeedHeight(height);
            }
          }}
        >
          <ScrollView
            ref={feedScrollRef}
            style={{flex:1}}
            pagingEnabled
            snapToInterval={reelHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAllFeeds} tintColor={C.magenta} colors={[C.pink,C.magenta]} />}
            onMomentumScrollEnd={event=>{
              const index=Math.round(event.nativeEvent.contentOffset.y/reelHeight);
              setActiveReelIndex(Math.max(0,Math.min(index,visibleReels.length-1)));
            }}
            onScrollEndDrag={event=>{
              const index=Math.round(event.nativeEvent.contentOffset.y/reelHeight);
              setActiveReelIndex(Math.max(0,Math.min(index,visibleReels.length-1)));
            }}
            scrollEventThrottle={16}
          >
            {visibleReels.map((reel,index)=>(
              <ReelCard
                key={reel.id}
                reel={reel}
                height={reelHeight}
                showViews={false}
                isActive={page==="Home"&&index===activeReelIndex}
                liked={!!liked[reel.id]}
                saved={!!saved[reel.id]}
                likeCount={likeCounts[reel.id]??Number(reel.likes||0)}
                commentCount={commentCounts[reel.id]||0}
                saveCount={saveCounts[reel.id]||0}
                following={!!(reel.ownerId&&following[reel.ownerId])}
                onLike={()=>toggleLike(reel.id)}
                onDoubleLike={()=>{if(!liked[reel.id]) toggleLike(reel.id);}}
                onSave={()=>toggleSave(reel.id)}
                onFollow={()=>toggleFollow(reel)}
                onComment={()=>openComments(reel)}
                onQuickReaction={(emoji)=>postQuickReaction(reel,emoji)}
                shareCount={shareCounts[reel.id]||0}
                repostCount={repostCounts[reel.id]||0}
                reposted={!!myReposts[reel.id]}
                onShare={()=>shareReel(reel)}
                onRepost={()=>toggleRepost(reel)}
                onSound={()=>openSound(reel)}
                onOpenProfile={openUserProfile}
                isOwner={reel.ownerId===user?.id}
                onDelete={()=>confirmDeletePost(reel)}
              />
            ))}

            {visibleReels.length===0&&(
              <View style={[styles.emptyFeed,{height:reelHeight}]}>
                <Text style={{fontSize:42}}>👥</Text>
                <Text style={styles.emptyText}>Following feed mein abhi videos nahi hain. Creators ko follow karein.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  }

  function renderExplore() {
    const friendIds=new Set(mutualFriends.map(friend=>friend.id));
    const friendReels=allReels.filter(reel=>reel.ownerId&&friendIds.has(reel.ownerId));

    return (
      <View style={styles.screen}>
        <View style={styles.friendsHeader}>
          <Text style={styles.pageTitle}>Friends</Text>
          <TouchableOpacity onPress={()=>setPage("Explore")}><Text style={styles.searchIcon}>⌕</Text></TouchableOpacity>
        </View>
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.friendsContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAllFeeds} tintColor={C.magenta} colors={[C.pink,C.magenta]} />}
        >
          <Text style={styles.friendsSectionTitle}>Friends</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendAvatarsRow}>
            {mutualFriends.map(friend=>(
              <TouchableOpacity key={friend.id} style={styles.friendAvatarItem} onPress={()=>openUserProfile(friend.id)}>
                <View style={styles.friendAvatarRing}>
                  {friend.profileImage
                    ? <Image source={{uri:friend.profileImage}} style={styles.friendAvatarImage}/>
                    : <Text style={styles.friendAvatarFallback}>👤</Text>}
                </View>
                <Text numberOfLines={1} style={styles.friendAvatarName}>{friend.username}</Text>
              </TouchableOpacity>
            ))}
            {mutualFriends.length===0&&<Text style={styles.smallMuted}>Follow back karne wale friends yahan dikhai denge.</Text>}
          </ScrollView>
          <Text style={styles.friendsSectionTitle}>Friends' Reels</Text>
          {friendReels.map((reel,index)=>(
            <View key={reel.id} style={styles.friendReelCard}>
              <ReelCard
                reel={reel}
                height={560}
                isActive={page==="Explore"}
                liked={!!liked[reel.id]}
                saved={!!saved[reel.id]}
                likeCount={likeCounts[reel.id]??Number(reel.likes||0)}
                following={!!following[reel.ownerId]}
                onLike={()=>toggleLike(reel.id)}
                onDoubleLike={()=>{if(!liked[reel.id]) toggleLike(reel.id);}}
                onSave={()=>toggleSave(reel.id)}
                onFollow={()=>toggleFollow(reel)}
                onComment={()=>openComments(reel)}
                onQuickReaction={(emoji)=>postQuickReaction(reel,emoji)}
                shareCount={shareCounts[reel.id]||0}
                repostCount={repostCounts[reel.id]||0}
                reposted={!!myReposts[reel.id]}
                onShare={()=>shareReel(reel)}
                onRepost={()=>toggleRepost(reel)}
                onSound={()=>openSound(reel)}
              />
            </View>
          ))}
          {friendReels.length===0&&(
            <View style={styles.friendsEmpty}>
              <Text style={{fontSize:42}}>👥</Text>
              <Text style={styles.emptyText}>Aapke friends ki uploaded Reels yahan nazar aayengi.</Text>
              <Text style={styles.smallMuted}>Friends tabhi bante hain jab dono users ek doosre ko follow karte hain.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  function renderInbox() {
    if(selectedChat)return (
      <KeyboardAvoidingView style={styles.inboxPage} behavior={Platform.OS==="ios"?"padding":"padding"} keyboardVerticalOffset={0}>
        <View style={styles.inboxHeader}><TouchableOpacity onPress={()=>{setChatInputFocused(false);setSelectedChat(null);}}><Text style={styles.inboxBack}>‹</Text></TouchableOpacity><TouchableOpacity onPress={()=>openUserProfile(selectedChat.otherUserId)}><Text style={styles.inboxTitle}>@{selectedChat.otherUsername||"User"}</Text></TouchableOpacity><TouchableOpacity onPress={()=>openInboxConversation(selectedChat)}><Text style={styles.recipientSend}>Refresh ↻</Text></TouchableOpacity></View>
        {conversationLoading?<ActivityIndicator color={C.magenta} style={{marginTop:24}}/>:<ScrollView ref={messageScrollRef} style={styles.messageList} contentContainerStyle={styles.messageListContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" onContentSizeChange={()=>messageScrollRef.current?.scrollToEnd({animated:true})}>
          {conversationMessages.map(message=><View key={message.id} style={[styles.messageBubble,message.senderId===user.id?styles.myMessageBubble:styles.theirMessageBubble]}>
            {message.type==="video"&&message.post&&<TouchableOpacity style={styles.messageVideoCard} onPress={()=>{const item=allReels.find(p=>p.id===message.post.postId);if(item){setPlayingPost(item);setPage("Home");}else Alert.alert("Video unavailable","Original video abhi load nahi hui.");}}>
              <Text style={styles.messageVideoIcon}>▶</Text><View style={{flex:1}}><Text style={styles.messageVideoCreator}>@{message.post.creator||"Creator"}</Text><Text numberOfLines={2} style={styles.messageVideoCaption}>{message.post.caption||"Shared a video"}</Text></View>
            </TouchableOpacity>}
            {!!message.text&&<Text style={styles.messageText}>{message.text}</Text>}<Text style={styles.messageTime}>{message.createdAt?new Date(message.createdAt).toLocaleString():""}</Text>
          </View>)}
          {!conversationMessages.length&&<Text style={styles.smallMuted}>Abhi koi message nahi.</Text>}
        </ScrollView>}
        <View style={styles.messageComposer}><TextInput value={messageDraft} onChangeText={setMessageDraft} onFocus={()=>setChatInputFocused(true)} onBlur={()=>setChatInputFocused(false)} placeholder="Message likhein..." placeholderTextColor={C.gray} style={styles.messageComposerInput} multiline blurOnSubmit={false} returnKeyType="default" onContentSizeChange={()=>messageScrollRef.current?.scrollToEnd({animated:true})}/><TouchableOpacity style={[styles.messageSendButton,(!messageDraft.trim()||messageSendingText)&&{opacity:0.55}]} onPress={sendDirectMessage} disabled={messageSendingText||!messageDraft.trim()}><Text style={styles.messageSendText}>{messageSendingText?"...":"Send"}</Text></TouchableOpacity></View>
      </KeyboardAvoidingView>
    );
    const chats=Object.entries(userChats).map(([chatId,item])=>({chatId,...item})).sort((a,b)=>(b.lastMessageAt||0)-(a.lastMessageAt||0));
    const filteredChats=chats.filter(chat=>{
      const matches=String(chat.otherUsername||"").toLowerCase().includes(inboxSearch.trim().toLowerCase().replace(/^@/,""));
      const unread=chat.lastMessageSenderId&&chat.lastMessageSenderId!==user.id;
      return matches&&(inboxFilter!=="Unread"||unread);
    });
    const people=mutualFriends.slice(0,12);
    return <View style={styles.inboxPage}>
      <View style={styles.inboxHeader}>
        <TouchableOpacity style={styles.inboxHeaderAction} onPress={()=>{setInboxSearchOpen(v=>!v);setInboxSearch("");}}><Text style={styles.inboxHeaderIcon}>⌕</Text></TouchableOpacity>
        <View style={styles.inboxHeaderCenter}><Text style={styles.inboxTitle}>Inbox</Text><View style={styles.inboxStatus}><View style={styles.inboxStatusDot}/><Text style={styles.inboxStatusText}>Messages</Text></View></View>
        <TouchableOpacity style={styles.inboxHeaderAction} onPress={loadSocialRecords}><Text style={styles.inboxHeaderIcon}>•••</Text></TouchableOpacity>
      </View>
      {inboxSearchOpen&&<View style={styles.inboxSearchWrap}><TextInput value={inboxSearch} onChangeText={setInboxSearch} placeholder="Search chats..." placeholderTextColor={C.gray} style={styles.inboxSearchInput}/><TouchableOpacity onPress={()=>{setInboxSearchOpen(false);setInboxSearch("");}}><Text style={styles.inboxSearchClose}>✕</Text></TouchableOpacity></View>}
      <ScrollView contentContainerStyle={styles.inboxList} showsVerticalScrollIndicator={false}>
        <View style={styles.inboxPeopleSection}>
          <View style={styles.inboxPeopleHeading}><Text style={styles.inboxSectionTitle}>People</Text><Text style={styles.inboxSectionHint}>Your friends</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inboxPeopleRow}>
            <TouchableOpacity style={styles.inboxPersonItem} onPress={()=>{setPage("Explore");}}>
              <View style={styles.inboxCreateCircle}><Text style={styles.inboxCreatePlus}>＋</Text></View><Text numberOfLines={1} style={styles.inboxPersonName}>Find people</Text>
            </TouchableOpacity>
            {people.map(person=><TouchableOpacity key={person.id} style={styles.inboxPersonItem} onPress={()=>openUserProfile(person.id)}>
              <View style={styles.inboxStoryRing}><View style={styles.inboxPersonAvatar}>{person.profileImage?<Image source={{uri:person.profileImage}} style={styles.inboxPersonAvatarImage}/>:<Text style={styles.inboxPersonFallback}>👤</Text>}</View></View>
              <Text numberOfLines={1} style={styles.inboxPersonName}>{person.username||"Friend"}</Text>
            </TouchableOpacity>)}
          </ScrollView>
        </View>
        <View style={styles.inboxFilters}>
          {["Main","Requests","Unread"].map(tab=><TouchableOpacity key={tab} onPress={()=>setInboxFilter(tab)} style={[styles.inboxFilterChip,inboxFilter===tab&&styles.inboxFilterActive]}><Text style={[styles.inboxFilterText,inboxFilter===tab&&styles.inboxFilterTextActive]}>{tab}</Text></TouchableOpacity>)}
          <TouchableOpacity style={styles.inboxFilterIcon} onPress={loadSocialRecords}><Text style={styles.inboxFilterIconText}>☷</Text></TouchableOpacity>
        </View>
        {inboxFilter==="Requests"?<>{Object.entries(messageRequests).map(([senderId,request])=><View key={senderId} style={styles.inboxRequestRow}>
          <View style={styles.inboxAvatar}><Text>👤</Text></View>
          <View style={{flex:1}}><Text style={styles.inboxChatName}>{request.requesterUsername||"User"}</Text><Text numberOfLines={2} style={styles.inboxPreview}>{request.type==="video"?"🎬 Video message request":request.text||"Wants to message you"}</Text>
          <View style={styles.inboxRequestActions}><TouchableOpacity style={styles.inboxAcceptButton} onPress={()=>acceptMessageRequest(request)}><Text style={styles.inboxAcceptText}>Accept</Text></TouchableOpacity><TouchableOpacity style={styles.inboxIgnoreButton} onPress={()=>ignoreMessageRequest(request)}><Text style={styles.inboxIgnoreText}>Ignore</Text></TouchableOpacity></View></View>
        </View>)}{!Object.keys(messageRequests).length&&<View style={styles.inboxEmpty}><Text style={styles.inboxEmptyIcon}>✉</Text><Text style={styles.inboxEmptyTitle}>Message requests</Text><Text style={styles.inboxEmptyText}>Abhi koi message request nahi hai.</Text></View>}</>:<>
          {filteredChats.map(chat=>{
            const profile=userProfiles[chat.otherUserId]||people.find(person=>person.id===chat.otherUserId)||{};
            const unread=chat.lastMessageSenderId&&chat.lastMessageSenderId!==user.id;
            return <TouchableOpacity key={chat.chatId} style={styles.inboxChatRow} onPress={()=>openInboxConversation(chat)}>
              <View style={styles.inboxAvatar}>{profile.profileImage?<Image source={{uri:profile.profileImage}} style={styles.inboxAvatarImage}/>:<Text>👤</Text>}</View>
              <View style={{flex:1}}><Text style={styles.inboxChatName}>{chat.otherUsername||profile.username||"User"}</Text><Text numberOfLines={1} style={styles.inboxPreview}>{chat.lastMessageType==="video"?"🎬 Shared a video":chat.lastMessageText||"Start a conversation"}</Text></View>
              <View style={styles.inboxChatMeta}>{unread&&<View style={styles.inboxUnreadDot}/>}<Text style={styles.inboxTime}>{chat.lastMessageAt?new Date(chat.lastMessageAt).toLocaleDateString():""}</Text></View>
            </TouchableOpacity>;
          })}
          {!filteredChats.length&&<View style={styles.inboxEmpty}><Text style={styles.inboxEmptyIcon}>✉</Text><Text style={styles.inboxEmptyTitle}>{inboxFilter==="Unread"?"No unread messages":"Your messages"}</Text><Text style={styles.inboxEmptyText}>{inboxFilter==="Unread"?"Aapke unread messages yahan nazar aayenge.":"Video par Share dabakar kisi user ko bhejein; chats yahan nazar aayengi."}</Text></View>}
        </>}
      </ScrollView>
    </View>;
  }

  function renderCreate() {
    if(createStep==="gallery") {
      const visibleAssets=galleryAssets.filter(asset=>galleryTab==="All"||(galleryTab==="Videos"?asset.mediaType==="video":galleryTab==="Photos"?asset.mediaType==="photo":false));
      const rows=[]; for(let i=0;i<visibleAssets.length;i+=3) rows.push(visibleAssets.slice(i,i+3));
      const selectedAssets=gallerySelectedIds.map(id=>galleryAssets.find(asset=>(asset.id||asset.uri)===id)).filter(Boolean);
      return (
        <View style={{flex:1,backgroundColor:"#fff"}}>
          <View style={{height:58,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#eee"}}>
            <TouchableOpacity onPress={()=>setCreateStep("camera")} style={{width:38,height:44,alignItems:"flex-start",justifyContent:"center"}}><Text style={{fontSize:30,color:"#111",lineHeight:34}}>×</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>Alert.alert("Albums","Abhi Recents album khula hai.")} style={{flexDirection:"row",alignItems:"center",gap:6}}><Text style={{fontSize:19,fontWeight:"800",color:"#111"}}>Recents</Text><Text style={{fontSize:18,color:"#111"}}>⌄</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>Alert.alert("Text","Text option aglay editor step mein set karenge.")} style={{paddingHorizontal:12,paddingVertical:8,borderRadius:18,backgroundColor:"#f3f3f3"}}><Text style={{fontSize:13,fontWeight:"800",color:"#222"}}>✎ Text</Text></TouchableOpacity>
          </View>
          <View style={{height:48,flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#eee"}}>
            {["All","Videos","Photos","AI Gallery"].map(tab=><TouchableOpacity key={tab} onPress={()=>setGalleryTab(tab)} style={{flex:1,alignItems:"center",justifyContent:"center",borderBottomWidth:galleryTab===tab?2:0,borderBottomColor:"#111"}}><Text numberOfLines={1} style={{fontSize:14,fontWeight:galleryTab===tab?"900":"600",color:galleryTab===tab?"#111":"#888"}}>{tab}</Text></TouchableOpacity>)}
          </View>
          {galleryLoading?<View style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator size="large" color={C.pink}/><Text style={{color:"#555",marginTop:12}}>Gallery load ho rahi hai...</Text></View>:<ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:8}}>
            {galleryTab==="AI Gallery"&&!visibleAssets.length?<View style={{flex:1,alignItems:"center",justifyContent:"center",paddingTop:55}}><Text style={{fontSize:15,color:"#777",fontWeight:"700"}}>AI Gallery mein abhi media nahi hai</Text></View>:rows.map((row,index)=><View key={index} style={{flexDirection:"row",gap:2,marginBottom:2}}>
              {row.map(asset=>{const key=asset.id||asset.uri,selectedIndex=gallerySelectedIds.indexOf(key);return <TouchableOpacity key={key} onPress={()=>toggleGalleryAsset(asset)} style={{width:"33.05%",aspectRatio:1,backgroundColor:"#ddd"}}>
                <Image source={{uri:asset.uri}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>
                {asset.mediaType==="video"&&<View style={{position:"absolute",bottom:5,right:5,backgroundColor:"#0009",paddingHorizontal:5,paddingVertical:2,borderRadius:5}}><Text style={{color:"#fff",fontSize:10}}>{Math.floor((asset.duration||0)/60)>0?Math.floor((asset.duration||0)/60)+":":""}{String(Math.round((asset.duration||0)%60)).padStart(2,"0")}</Text></View>}
                <View style={{position:"absolute",top:7,right:7,width:24,height:24,borderRadius:12,backgroundColor:selectedIndex>=0?C.pink:"#0002",borderWidth:1.5,borderColor:"#fff",alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontWeight:"900",fontSize:12}}>{selectedIndex>=0?selectedIndex+1:""}</Text></View>
              </TouchableOpacity>;})}
              {row.length<3&&Array.from({length:3-row.length}).map((_,i)=><View key={"empty"+i} style={{width:"33.05%",aspectRatio:1}}/>)}
            </View>)}
            {!visibleAssets.length&&galleryTab!=="AI Gallery"&&<Text style={{textAlign:"center",color:"#777",marginTop:40}}>Is category mein media nahi mila.</Text>}
          </ScrollView>}
          <View style={{backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#eee",paddingTop:7,paddingBottom:Platform.OS==="android"?42:10}}> 
            <TouchableOpacity onPress={()=>setGalleryUseLayout(v=>!v)} style={{height:28,flexDirection:"row",alignItems:"center",paddingHorizontal:20,gap:7}}>
              <View style={{width:17,height:17,borderRadius:9,borderWidth:1.5,borderColor:galleryUseLayout?C.pink:"#aaa",backgroundColor:galleryUseLayout?C.pink:"#fff",alignItems:"center",justifyContent:"center"}}>{galleryUseLayout&&<Text style={{color:"#fff",fontSize:10,fontWeight:"900"}}>✓</Text>}</View>
              <Text style={{fontSize:12,color:"#555",fontWeight:"600"}}>Use layout</Text>
              <Text style={{marginLeft:"auto",fontSize:11,color:"#999"}}>{gallerySelectedIds.length}/15 selected</Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{height:76}} contentContainerStyle={{paddingHorizontal:14,alignItems:"center",gap:8}}>
              {selectedAssets.map((asset,index)=><View key={asset.id||asset.uri} style={{width:66,height:66,borderRadius:9,overflow:"hidden",backgroundColor:"#eee"}}>
                <Image source={{uri:asset.uri}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>
                <View style={{position:"absolute",left:3,bottom:3,backgroundColor:"#0009",paddingHorizontal:5,borderRadius:8}}><Text style={{color:"#fff",fontSize:10,fontWeight:"800"}}>{index+1}</Text></View>
                <TouchableOpacity onPress={()=>toggleGalleryAsset(asset)} style={{position:"absolute",right:2,top:2,width:20,height:20,borderRadius:10,backgroundColor:"#0009",alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontSize:15,lineHeight:17}}>×</Text></TouchableOpacity>
              </View>)}
            </ScrollView>
            <View style={{height:64,flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingTop:5,gap:10}}>
              <TouchableOpacity onPress={()=>Alert.alert("AutoCut","AutoCut ka editing workflow aglay step mein connect karenge.")} style={{height:48,flex:1,borderRadius:28,backgroundColor:"#f1f1f1",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8}}>
                <Text style={{fontSize:18,color:C.pink}}>▣</Text><Text style={{fontSize:16,fontWeight:"900",color:"#161616"}}>AutoCut</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={continueFromGallery} disabled={!gallerySelectedIds.length} style={{height:48,flex:1,borderRadius:28,backgroundColor:gallerySelectedIds.length?C.pink:"#e5e5e5",alignItems:"center",justifyContent:"center"}}>
                <Text style={{color:"#fff",fontSize:17,fontWeight:"900"}}>Next ({gallerySelectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
    if(createStep==="camera") {
      const firstMedia=selectedCreateMedia[0];
      const firstIsPhoto=firstMedia&&(firstMedia.type==="image"||firstMedia.mimeType?.startsWith("image/"));
      return (
        <View style={{flex:1,backgroundColor:"#000"}}>
          {cameraPermissionGranted ? (
            <CameraView ref={cameraRef} style={{flex:1}} facing={cameraFacing} mode="video" enableTorch={torchEnabled&&cameraFacing==="back"}>
              <View style={{flex:1,justifyContent:"space-between",paddingTop:12,paddingBottom:12,paddingHorizontal:14}}>
                <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                  <TouchableOpacity onPress={()=>{if(isRecording)stopCameraRecording();setPage("Home");}} style={{width:44,height:44,borderRadius:22,backgroundColor:"#0009",alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontSize:28}}>‹</Text></TouchableOpacity>
                  <Text style={{color:"#fff",fontSize:16,fontWeight:"900",letterSpacing:1}}>GEN-LIVE</Text>
                  <TouchableOpacity onPress={()=>setCameraFacing(v=>{if(v==="back")setTorchEnabled(false);return v==="back"?"front":"back";})} style={{width:44,height:44,borderRadius:22,backgroundColor:"#0009",alignItems:"center",justifyContent:"center"}}><Text style={{color:"#fff",fontSize:22}}>↻</Text></TouchableOpacity>
                </View>
                <View style={{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"flex-end"}}>
                  <View style={{position:"absolute",right:0,top:"10%",alignItems:"center",gap:13,backgroundColor:"#080710B8",paddingVertical:12,paddingHorizontal:9,borderRadius:24}}>
                    {showCameraTools&&<TouchableOpacity onPress={()=>{if(cameraFacing!=="back")return Alert.alert("Flash unavailable","Flash sirf back camera par available hai.");setTorchEnabled(v=>!v);}} style={{alignItems:"center",width:38}}><Text style={{fontSize:25,color:torchEnabled?"#ffd76a":"#fff"}}>ϟ</Text><Text style={{fontSize:9,color:"#fff"}}>{torchEnabled?"ON":"FLASH"}</Text></TouchableOpacity>}
                    <TouchableOpacity onPress={()=>setShowBrightnessControl(v=>!v)} style={{alignItems:"center",width:38,paddingVertical:3}}>
                      <Text style={{fontSize:25,color:showBrightnessControl?"#ffd76a":"#fff"}}>☀</Text>
                    </TouchableOpacity>
                    {showBrightnessControl&&<View onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderGrant={e=>setCameraBrightness(Math.max(-0.45,Math.min(0.45,0.45-e.nativeEvent.locationY/130*0.9)))} onResponderMove={e=>setCameraBrightness(Math.max(-0.45,Math.min(0.45,0.45-e.nativeEvent.locationY/130*0.9)))} style={{height:126,width:27,borderRadius:15,backgroundColor:"#ffffff66",alignItems:"center",justifyContent:"center"}}>
                      <View style={{width:24,height:8,borderRadius:5,backgroundColor:"#fff",borderWidth:1,borderColor:"#333",transform:[{translateY:-cameraBrightness/0.9*63}]}}/>
                    </View>}
                    <TouchableOpacity onPress={()=>setShowCameraTools(v=>!v)} style={{width:38,height:30,alignItems:"center",justifyContent:"center"}}>
                      <Text style={{fontSize:22,color:"#fff"}}>{showCameraTools?"⌄":"⌃"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{alignItems:"center",paddingBottom:7}}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:10,paddingTop:5}}>{cameraFilterCategories.map(category=><TouchableOpacity key={category.category} onPress={()=>{setActiveCameraFilterCategory(category.category);setCameraFilter(category.filters[0]?.slug||"clear");}} style={{paddingHorizontal:12,paddingVertical:5,borderRadius:14,backgroundColor:activeCameraFilterCategory===category.category?C.pink:"#0009"}}><Text style={{color:"#fff",fontSize:10,fontWeight:"800"}}>{category.category.toUpperCase()}</Text></TouchableOpacity>)}</ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems:"center",gap:15,paddingHorizontal:12,paddingVertical:9}}>
                    {cameraFilters.filter(item=>cameraFilterCategories.find(category=>category.category===activeCameraFilterCategory)?.filters.some(filter=>filter.slug===item.slug)).map(item=><TouchableOpacity key={item.slug} onPress={()=>setCameraFilter(item.slug)} style={{alignItems:"center",width:58}}>
                      <View style={{width:48,height:48,borderRadius:24,backgroundColor:item.tint||"#373544",borderWidth:cameraFilter===item.slug?3:1.5,borderColor:cameraFilter===item.slug?C.pink:"#ffffffaa",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                        <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:item.tint||"rgba(255,255,255,0.08)"}}/>
                        <Text style={{fontSize:17,color:"#fff"}}>{item.id==="grayscale"?"◐":item.id==="warm"?"☀":item.id==="sepia"?"◉":item.id==="cool"?"❄":item.id==="vignette"?"✦":item.id==="contrast"?"◒":item.id==="saturation"?"✺":"◌"}</Text>
                      </View>
                      <Text numberOfLines={1} style={{color:"#fff",fontSize:10,fontWeight:cameraFilter===item.slug?"900":"700",marginTop:4}}>{item.label}</Text>
                    </TouchableOpacity>)}
                  </ScrollView>
                  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"center",width:"100%",paddingTop:3}}>
                    <View style={{width:64,alignItems:"center"}}><Text style={{color:"#fff",fontSize:10,fontWeight:"800"}}>{isRecording?"● REC":"VIDEO"}</Text></View>
                    <TouchableOpacity onPress={isRecording?stopCameraRecording:recordVideo} activeOpacity={0.8} style={{width:86,height:86,borderRadius:43,borderWidth:6,borderColor:"#fff",alignItems:"center",justifyContent:"center",backgroundColor:isRecording?C.pink:"#ffffff33"}}><View style={{width:isRecording?28:60,height:isRecording?28:60,borderRadius:isRecording?6:30,backgroundColor:isRecording?C.white:C.pink}}/></TouchableOpacity>
                    <View style={{width:64,alignItems:"center"}}><Text style={{color:"#fff",fontSize:10,fontWeight:"800"}}>{(cameraFilters.find(x=>x.slug===cameraFilter)?.name||"CLEAR").toUpperCase()}</Text></View>
                  </View>
                  {isRecording&&<Text style={{color:"#fff",fontWeight:"900",backgroundColor:"#0009",paddingHorizontal:12,paddingVertical:5,borderRadius:12,marginTop:5}}>● RECORDING</Text>}
                </View>
                <View style={{height:66,backgroundColor:"#050505",borderRadius:14,flexDirection:"row",alignItems:"center",justifyContent:"space-around",marginBottom:3}}>
                  <TouchableOpacity onPress={chooseVideoFromGallery} style={{flex:1,alignItems:"center",justifyContent:"center",height:"100%"}}>{firstIsPhoto?<Image source={{uri:firstMedia.uri}} style={{width:34,height:34,borderRadius:6}}/>:<Text style={{fontSize:21,color:"#fff"}}>▧</Text>}<Text style={{color:"#fff",fontSize:12,fontWeight:"800"}}>GALLERY</Text>{selectedCreateMedia.length>0&&<Text style={{position:"absolute",top:1,right:20,color:C.pink,fontSize:10,fontWeight:"900"}}>{selectedCreateMedia.length}</Text>}</TouchableOpacity>
                  <TouchableOpacity onPress={()=>{if(isRecording)stopCameraRecording();else Alert.alert("Camera ready","Beech wala gol button dabakar recording shuru karein.");}} style={{flex:1,alignItems:"center",justifyContent:"center",height:"100%"}}><Text style={{color:"#fff",fontSize:14,fontWeight:"900"}}>CAMERA</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>{if(selectedVideo?.uri)setCreateStep("selected");else if(selectedCreateMedia.some(x=>x.type==="video"||x.mimeType?.startsWith("video/")))setCreateStep("selected");else Alert.alert("Create","Pehle video record karein ya Gallery se video select karein.");}} style={{flex:1,alignItems:"center",justifyContent:"center",height:"100%"}}><Text style={{color:C.pink,fontSize:14,fontWeight:"900"}}>CREATE</Text></TouchableOpacity>
                </View>
              </View>
              {(cameraFilters.find(x=>x.slug===cameraFilter)?.tint||cameraBrightness!==0)&&<View pointerEvents="none" style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:cameraBrightness>0.08?"rgba(255,255,255,0.14)":cameraBrightness< -0.08?"rgba(0,0,0,0.18)":(cameraFilters.find(x=>x.slug===cameraFilter)?.tint||"transparent")}}/>}
            </CameraView>
          ) : (
            <View style={{flex:1,alignItems:"center",justifyContent:"center",padding:24}}>
              <Text style={{color:"#fff",fontSize:18,fontWeight:"800",textAlign:"center"}}>Camera permission required</Text>
              <Text style={{color:C.gray,textAlign:"center",marginTop:8}}>Camera preview ke liye permission allow karein.</Text>
              <Button title="Allow Camera" onPress={async()=>{const result=await Camera.requestCameraPermissionsAsync();setCameraPermissionGranted(!!result.granted);}}/>
              <Button title="Open Gallery" secondary onPress={chooseVideoFromGallery}/>
              <TouchableOpacity onPress={()=>setPage("Home")} style={{marginTop:18}}><Text style={{color:C.magenta}}>‹ Back</Text></TouchableOpacity>
            </View>
          )}
        </View>
      );
    }
    if(createStep==="selected"||createStep==="location"||createStep==="post") {
      const directVideo=selectedVideo||selectedCreateMedia.find(item=>item.type==="video"||item.mimeType?.startsWith("video/"))||null;
      const section=(key,title,summary,content)=>(
        <View style={{borderWidth:1,borderColor:C.border,borderRadius:14,overflow:"hidden",marginTop:10,backgroundColor:C.card}}>
          <TouchableOpacity onPress={()=>setOpenPostSection(v=>v===key?"":key)} style={{minHeight:58,paddingHorizontal:14,paddingVertical:11,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
            <View style={{flex:1,paddingRight:12}}>
              <Text style={{color:C.white,fontSize:15,fontWeight:"900"}}>{title}</Text>
              {!!summary&&<Text numberOfLines={1} style={{color:C.gray,fontSize:11,marginTop:3}}>{summary}</Text>}
            </View>
            <Text style={{color:C.magenta,fontSize:22,fontWeight:"900"}}>{openPostSection===key?"−":"＋"}</Text>
          </TouchableOpacity>
          {openPostSection===key?<View style={{paddingHorizontal:14,paddingBottom:14,borderTopWidth:1,borderTopColor:C.border,paddingTop:12}}>{content}</View>:null}
        </View>
      );
      return (
        <View style={{flex:1,backgroundColor:C.bg}}>
          <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:16,paddingTop:12,paddingBottom:24}} keyboardShouldPersistTaps="handled">
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <TouchableOpacity onPress={()=>setCreateStep("gallery")}><Text style={{color:C.magenta,fontSize:16,fontWeight:"900"}}>‹ Back</Text></TouchableOpacity>
              <Text style={{color:C.white,fontSize:20,fontWeight:"900"}}>Post Video</Text>
              <TouchableOpacity onPress={()=>setCreateStep("gallery")}><Text style={{color:C.magenta,fontSize:13,fontWeight:"800"}}>Change</Text></TouchableOpacity>
            </View>

            <View style={{backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:18,padding:12}}>
              {directVideo?.uri ? <Video source={{uri:directVideo.uri}} style={{width:"100%",height:270,backgroundColor:"#000",borderRadius:12}} useNativeControls volume={selectedSound?Math.max(0,Math.min(100,originalVideoVolume))/100:1} isMuted={!!selectedSound&&originalVideoVolume<=0} resizeMode={ResizeMode.CONTAIN}/> : createPhotos[0]?.uri ? <Image source={{uri:createPhotos[0].uri}} style={{width:"100%",height:270,backgroundColor:"#000",borderRadius:12}} resizeMode="contain"/> : <View style={{height:190,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.gray}}>Pehle Gallery se photo ya video select karein.</Text></View>}
              {createPhotos.length>0&&<Text style={{color:C.green,fontSize:12,fontWeight:"800",marginTop:8}}>{createPhotos.length} photo(s) selected</Text>}
              {selectedSound?<View style={{marginTop:12,padding:12,backgroundColor:C.card2,borderRadius:12,gap:12}}>
                <Text style={{color:C.white,fontSize:15,fontWeight:"900"}}>🎵 Sound Mix · {selectedSound}</Text>
                <View style={{gap:6}}>
                  <Text style={{color:C.white,fontWeight:"800"}}>Selected Sound · {selectedSoundVolume}%</Text>
                  <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
                    <TouchableOpacity onPress={()=>setSelectedSoundVolume(v=>Math.max(0,v-5))} style={{width:36,height:36,borderRadius:10,backgroundColor:C.card,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>−</Text></TouchableOpacity>
                    <View style={{flex:1,height:8,borderRadius:8,backgroundColor:C.border,overflow:"hidden"}}><View style={{width:`${selectedSoundVolume}%`,height:8,backgroundColor:C.pink}}/></View>
                    <TouchableOpacity onPress={()=>setSelectedSoundVolume(v=>Math.min(100,v+5))} style={{width:36,height:36,borderRadius:10,backgroundColor:C.card,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>＋</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={{gap:9}}>
                  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                    <Text style={{color:C.white,fontWeight:"800"}}>Original Video Sound · {originalVideoVolume}%</Text>
                    <TouchableOpacity onPress={()=>setOriginalVideoVolume(v=>v>0?0:70)} style={{paddingHorizontal:13,paddingVertical:8,borderRadius:10,backgroundColor:originalVideoVolume===0?C.pink:C.card,borderWidth:1,borderColor:C.border}}>
                      <Text style={{color:C.white,fontWeight:"900"}}>{originalVideoVolume===0?"Unmute":"Mute"}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
                    <TouchableOpacity onPress={()=>setOriginalVideoVolume(v=>Math.max(0,v-5))} style={{width:36,height:36,borderRadius:10,backgroundColor:C.card,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>−</Text></TouchableOpacity>
                    <View style={{flex:1,height:9,borderRadius:9,backgroundColor:C.border,overflow:"hidden"}}><View style={{width:`${originalVideoVolume}%`,height:9,backgroundColor:C.green}}/></View>
                    <TouchableOpacity onPress={()=>setOriginalVideoVolume(v=>Math.min(100,v+5))} style={{width:36,height:36,borderRadius:10,backgroundColor:C.card,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>＋</Text></TouchableOpacity>
                  </View>
                  <View style={{flexDirection:"row",gap:6}}>
                    {[0,25,50,75,100].map(level=><TouchableOpacity key={level} onPress={()=>setOriginalVideoVolume(level)} style={{flex:1,paddingVertical:8,borderRadius:9,alignItems:"center",backgroundColor:originalVideoVolume===level?C.green:C.card,borderWidth:1,borderColor:C.border}}>
                      <Text style={{color:C.white,fontSize:11,fontWeight:"900"}}>{level===0?"Mute":level+"%"}</Text>
                    </TouchableOpacity>)}
                  </View>
                  <Text style={{color:C.gray,fontSize:11}}>0% = mute · 100% = original video ki full awaaz</Text>
                </View>
              </View>:null}
              <Text style={{color:C.gray,fontSize:11,marginTop:8}}>Video ka original frame size barqarar rahega.</Text>
            </View>

            <Text style={{color:C.gray,fontSize:13,fontWeight:"800",marginTop:16,marginBottom:7}}>Description / Caption</Text>
            <TextInput style={[styles.input,styles.captionInput,{minHeight:100,textAlignVertical:"top"}]} placeholder="Write a caption..." placeholderTextColor={C.gray} multiline value={caption} onChangeText={setCaption}/>

            {section("hashtags","# Hashtags",postHashtags||"Hashtags add karein",<TextInput style={styles.input} placeholder="#video #fun" placeholderTextColor={C.gray} value={postHashtags} onChangeText={setPostHashtags}/>)}
            {section("mention","@ Mention",postMention||"Username mention karein",<TextInput style={styles.input} placeholder="@username" placeholderTextColor={C.gray} value={postMention} onChangeText={setPostMention}/>)}
            {section("location","📍 Location",postLocation||"Location add karein",<TextInput style={styles.input} placeholder="Enter location" placeholderTextColor={C.gray} value={postLocation} onChangeText={setPostLocation}/>)}
            {section("privacy","Who can watch?",privacy,<View style={{gap:8}}>{["Public","Friends","Private"].map(v=><TouchableOpacity key={v} onPress={()=>setPrivacy(v)} style={[styles.selectedBox,{marginBottom:0}]}><Text style={styles.selectedTitle}>{privacy===v?"◉":"○"}  {v}</Text></TouchableOpacity>)}</View>)}
            {section("comments","Allow comments",allowComments?"Comments On":"Comments Off",<TouchableOpacity style={styles.selectedBox} onPress={()=>setAllowComments(v=>!v)}><Text style={styles.selectedTitle}>{allowComments?"✓ Comments On":"○ Comments Off"}</Text></TouchableOpacity>)}
            {section("reuse","Allow reuse / remix",allowReuse?"Reuse On":"Reuse Off",<TouchableOpacity style={styles.selectedBox} onPress={()=>setAllowReuse(v=>!v)}><Text style={styles.selectedTitle}>{allowReuse?"✓ Reuse On":"○ Reuse Off"}</Text></TouchableOpacity>)}
            {section("language","Video language",videoLanguage,<View style={{flexDirection:"row",gap:7}}>{["English","Urdu","Other"].map(v=><TouchableOpacity key={v} onPress={()=>setVideoLanguage(v)} style={{flex:1,minHeight:48,borderRadius:12,backgroundColor:videoLanguage===v?C.pink:C.card2,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontWeight:"800"}}>{v}</Text></TouchableOpacity>)}</View>)}
            {section("link","Add link",postLink||"Optional link",<TextInput style={styles.input} placeholder="https://..." placeholderTextColor={C.gray} value={postLink} onChangeText={setPostLink} autoCapitalize="none"/>)}

            <TouchableOpacity onPress={uploadVideoPost} disabled={uploading||(!directVideo?.uri&&!createPhotos.length)} style={{height:58,borderRadius:16,backgroundColor:uploading?"#777":C.pink,alignItems:"center",justifyContent:"center",marginTop:18,opacity:(directVideo?.uri||createPhotos.length)?1:0.55}}>
              <Text style={{color:"#fff",fontSize:18,fontWeight:"900"}}>{uploading?"Uploading...":"🚀 Publish Post"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveCurrentDraft} disabled={uploading} style={{height:52,borderRadius:15,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center",marginTop:9}}>
              <Text style={{color:C.white,fontSize:16,fontWeight:"800"}}>Save as Draft</Text>
            </TouchableOpacity>
            {uploading&&<View style={styles.uploadProgressBox}><View style={styles.uploadProgressHeader}><Text style={styles.uploadProgressTitle}>{uploadStage}</Text><Text style={styles.uploadPercent}>{uploadProgress}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${uploadProgress}%`}]}/></View><ActivityIndicator color={C.magenta} style={{marginTop:12}}/><Text style={styles.uploadHint}>Upload ke dauran app band na karein.</Text></View>}
          </ScrollView>
        </View>
      );
    }
    const pageTitle={camera:"Create Video",gallery:"Select Video",selected:"Video Preview",location:"Add Location",post:"Post Video"}[createStep]||"Create Video";
    const stepNumber={camera:"1/4",gallery:"2/4",selected:"3/4",location:"4/4",post:"4/4"}[createStep]||"1/4";
    const goBack=()=>{
      const prev={gallery:"camera",selected:"gallery",location:"selected",post:"location"}[createStep];
      if(prev)setCreateStep(prev);else setPage("Home");
    };
    const action=(label,onPress,secondary=false)=><Button title={label} onPress={onPress} secondary={secondary}/>;
    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <TouchableOpacity onPress={goBack}><Text style={{color:C.magenta,fontSize:16,fontWeight:"800"}}>‹ Back</Text></TouchableOpacity>
          <Text style={[styles.pageTitle,{fontSize:20,marginBottom:0}]}>{pageTitle}</Text>
          <Text style={{color:C.gray,fontSize:12}}>{stepNumber}</Text>
        </View>



        {createStep==="gallery"&&<View style={styles.card}>
          <Text style={styles.sectionTitle}>🖼 Select Photos & Videos</Text>
          <Text style={styles.helpText}>Phone ki Gallery se photos aur videos ek saath select karein. Aap maximum 15 files select kar sakte hain.</Text>
          <View style={{backgroundColor:"#21172b",borderRadius:14,padding:14,marginBottom:14,alignItems:"center"}}>
            <Text style={{color:C.magenta,fontSize:26,fontWeight:"900"}}>{selectedCreateMedia.length}/15</Text>
            <Text style={styles.helpText}>Selected photos & videos</Text>
          </View>
          <Button title="▣ Open Phone Gallery" onPress={chooseVideoFromGallery}/>
          <Button title="📁 Open File Manager" secondary onPress={openSystemFileManager}/>
          {selectedCreateMedia.length>0&&<View style={{marginTop:14}}>
            <Text style={styles.selectedTitle}>✓ {selectedCreateMedia.length} files selected</Text>
            {selectedCreateMedia.map((asset,index)=>(
              <View key={asset.assetId||asset.uri||String(index)} style={{paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.border}}>
                <Text style={{color:C.text,fontSize:13}}>{index+1}. {asset.type==="video"||asset.mimeType?.startsWith("video/")?"🎬 Video":"🖼 Photo"} · {asset.fileName||"Selected media"}</Text>
              </View>
            ))}
          </View>}
          <Button title="Continue" onPress={()=>{if(!selectedCreateMedia.length&&!selectedVideo?.uri&&!createPhotos.length)return Alert.alert("Select media","Pehle photo ya video select karein.");setCreateStep("selected");}}/>
        </View>}

        {createStep==="selected"&&<View style={styles.card}>
          <Text style={styles.sectionTitle}>▶ Video Preview</Text>
          {selectedVideo?.uri?<Video source={{uri:selectedVideo.uri}} style={{width:"100%",height:360,backgroundColor:"#000",borderRadius:14}} useNativeControls resizeMode={ResizeMode.CONTAIN}/>:<Text style={styles.helpText}>Pehle video select karein.</Text>}
          <Button title="Change Video" secondary onPress={()=>setCreateStep("gallery")}/>
          {selectedSound ? <View style={{backgroundColor:C.card,borderRadius:14,padding:14,marginTop:14,gap:12}}>
            <Text style={{color:C.white,fontSize:16,fontWeight:"900"}}>🎵 Sound Mix</Text>
            <View style={{gap:7}}>
              <Text style={{color:C.white,fontWeight:"800"}}>Selected Sound · {selectedSoundVolume}%</Text>
              <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
                <TouchableOpacity onPress={()=>setSelectedSoundVolume(v=>Math.max(0,v-5))} style={{width:38,height:38,borderRadius:10,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>−</Text></TouchableOpacity>
                <View style={{flex:1,height:9,borderRadius:9,backgroundColor:C.card2,overflow:"hidden"}}><View style={{width:`${selectedSoundVolume}%`,height:9,backgroundColor:C.pink}}/></View>
                <TouchableOpacity onPress={()=>setSelectedSoundVolume(v=>Math.min(100,v+5))} style={{width:38,height:38,borderRadius:10,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>＋</Text></TouchableOpacity>
              </View>
            </View>
            <View style={{gap:7}}>
              <Text style={{color:C.white,fontWeight:"800"}}>Original Video Sound · {originalVideoVolume}%</Text>
              <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
                <TouchableOpacity onPress={()=>setOriginalVideoVolume(v=>Math.max(0,v-5))} style={{width:38,height:38,borderRadius:10,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>−</Text></TouchableOpacity>
                <View style={{flex:1,height:9,borderRadius:9,backgroundColor:C.card2,overflow:"hidden"}}><View style={{width:`${originalVideoVolume}%`,height:9,backgroundColor:C.green}}/></View>
                <TouchableOpacity onPress={()=>setOriginalVideoVolume(v=>Math.min(100,v+5))} style={{width:38,height:38,borderRadius:10,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"}}><Text style={{color:C.white,fontSize:22}}>＋</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={{color:C.gray,fontSize:11}}>− aur ＋ se har awaaz 0% se 100% tak alag adjust karein.</Text>
          </View> : null}
          <Button title="Continue to Post Settings" onPress={()=>{if(!selectedVideo?.uri)return Alert.alert("Video required","Pehle video select karein.");setCreateStep("location");}}/>
        </View>}

        {createStep==="location"&&<View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Add Location</Text>
          <Text style={styles.helpText}>Apni video ki location likhein. Aap isay khaali bhi chhor sakte hain.</Text>
          <TextInput style={styles.input} placeholder="Enter location" placeholderTextColor={C.gray} value={postLocation} onChangeText={setPostLocation}/>
          <Button title="Continue to Post" onPress={()=>setCreateStep("post")}/>
        </View>}

        {createStep==="post"&&<View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 Post Video</Text>
          {selectedVideo?.uri&&<Video source={{uri:selectedVideo.uri}} style={{width:"100%",height:240,backgroundColor:"#000",borderRadius:14}} useNativeControls resizeMode={ResizeMode.CONTAIN}/>}
          <Text style={styles.fieldLabel}>Caption</Text>
          <TextInput style={[styles.input,styles.captionInput]} placeholder="Write a caption..." placeholderTextColor={C.gray} multiline value={caption} onChangeText={setCaption}/>
          <Text style={styles.fieldLabel}>Hashtags</Text>
          <TextInput style={styles.input} placeholder="#video #fun" placeholderTextColor={C.gray} value={postHashtags} onChangeText={setPostHashtags}/>
          <Text style={styles.fieldLabel}>Mention</Text>
          <TextInput style={styles.input} placeholder="@username" placeholderTextColor={C.gray} value={postMention} onChangeText={setPostMention}/>
          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} placeholder="Enter location" placeholderTextColor={C.gray} value={postLocation} onChangeText={setPostLocation}/>
          <Text style={styles.fieldLabel}>Who can watch?</Text>
          {["Public","Friends","Private"].map(v=><TouchableOpacity key={v} style={styles.selectedBox} onPress={()=>setPrivacy(v)}><Text style={styles.selectedTitle}>{privacy===v?"🔘":"◯"}  {v}</Text></TouchableOpacity>)}
          <Text style={styles.fieldLabel}>Allow comments</Text>
          <TouchableOpacity style={styles.selectedBox} onPress={()=>setAllowComments(v=>!v)}><Text style={styles.selectedTitle}>{allowComments?"✓":"○"}  {allowComments?"Comments On":"Comments Off"}</Text></TouchableOpacity>
          <Text style={styles.fieldLabel}>Allow reuse / remix</Text>
          <TouchableOpacity style={styles.selectedBox} onPress={()=>setAllowReuse(v=>!v)}><Text style={styles.selectedTitle}>{allowReuse?"✓":"○"}  {allowReuse?"Reuse On":"Reuse Off"}</Text></TouchableOpacity>
          <Text style={styles.fieldLabel}>Video language</Text>
          <View style={styles.buttonRow}>{["English","Urdu","Other"].map(v=><Button key={v} title={v} secondary={videoLanguage!==v} onPress={()=>setVideoLanguage(v)} style={{flex:1}}/>)}</View>
          <Text style={styles.fieldLabel}>Add link</Text>
          <TextInput style={styles.input} placeholder="https://..." placeholderTextColor={C.gray} value={postLink} onChangeText={setPostLink} autoCapitalize="none"/>
          <Button title={uploading?"Uploading...":"🚀 Publish Video"} onPress={uploadVideoPost} disabled={uploading}/>
          <Button title="Save as Draft" secondary onPress={saveCurrentDraft}/>
          {uploading&&<View style={styles.uploadProgressBox}><View style={styles.uploadProgressHeader}><Text style={styles.uploadProgressTitle}>{uploadStage}</Text><Text style={styles.uploadPercent}>{uploadProgress}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${uploadProgress}%`}]}/></View><ActivityIndicator color={C.magenta} style={{marginTop:12}}/><Text style={styles.uploadHint}>Upload ke dauran app band na karein.</Text></View>}
        </View>}
      </ScrollView>
    );
  }

    async function openUserProfile(profileId) {
    if(!profileId||profileId===user?.id){setSelectedProfileId(null);setSelectedProfileData(null);setProfileTab("Videos");setPage("Profile");return;}
    setSelectedProfileId(profileId);setSelectedProfileData(userProfiles[profileId]||null);setSelectedProfileFollowerCount(0);setProfileTab("Videos");setPage("Profile");
    try{const [pr,fr,fg]=await Promise.all([fetch(`${DATABASE_URL}/users/${encodeURIComponent(profileId)}.json?auth=${encodeURIComponent(user.token)}`),fetch(`${DATABASE_URL}/followers/${encodeURIComponent(profileId)}.json?auth=${encodeURIComponent(user.token)}`),fetch(`${DATABASE_URL}/following/${encodeURIComponent(profileId)}.json?auth=${encodeURIComponent(user.token)}`)]);const p=await pr.json(),f=await fr.json(),g=await fg.json();if(!pr.ok)throw new Error(p?.error||"Profile load nahi hui.");const clean={...(p&&typeof p==="object"?p:{}),followingCount:g&&typeof g==="object"?Object.keys(g).length:0};setSelectedProfileData(clean);setUserProfiles(old=>({...old,[profileId]:clean}));setSelectedProfileFollowerCount(f&&typeof f==="object"?Object.keys(f).length:0);}catch(error){Alert.alert("Profile",error.message||"Profile load nahi hui.");}
  }

  async function openDirectMessage(profileId,profile) {
    if(!profileId||profileId===user?.id)return;const other=profile||userProfiles[profileId]||{};const chatId=[String(user.id),String(profileId)].sort().join("__");const chat={chatId,otherUserId:profileId,otherUsername:other.username||"User",lastMessageType:"text",lastMessageText:"",lastMessageAt:Date.now(),lastMessageSenderId:""};
    try{const a=await fetch(`${DATABASE_URL}/userChats/${user.id}/${encodeURIComponent(chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(chat)});if(!a.ok)throw new Error("Chat open nahi hui. Firebase Rules check karein.");const b=await fetch(`${DATABASE_URL}/userChats/${profileId}/${encodeURIComponent(chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...chat,otherUserId:user.id,otherUsername:username||"User"})});if(!b.ok)throw new Error("Doosre user ki Inbox update nahi hui.");setUserChats(old=>({...old,[chatId]:chat}));setSelectedChat(chat);setConversationMessages([]);setMessageDraft("");setPage("Inbox");await openInboxConversation(chat);}catch(error){Alert.alert("Message",error.message||"Chat open nahi hui.");}
  }

  async function sendDirectMessage() {
    const text=messageDraft.trim();if(!text||!selectedChat||messageSendingText)return;setMessageSendingText(true);
    try{const now=Date.now(),message={type:"text",senderId:user.id,senderUsername:username||"User",recipientId:selectedChat.otherUserId,recipientUsername:selectedChat.otherUsername||"User",text,createdAt:now,seen:false};const r=await fetch(`${DATABASE_URL}/messages/${encodeURIComponent(selectedChat.chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(message)});const result=await r.json();if(!r.ok||!result?.name)throw new Error(result?.error||"Message send nahi hua.");const updated={...selectedChat,lastMessageType:"text",lastMessageText:text,lastMessageAt:now,lastMessageSenderId:user.id};await Promise.all([fetch(`${DATABASE_URL}/userChats/${user.id}/${encodeURIComponent(selectedChat.chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lastMessageType:"text",lastMessageText:text,lastMessageAt:now,lastMessageSenderId:user.id})}),fetch(`${DATABASE_URL}/userChats/${selectedChat.otherUserId}/${encodeURIComponent(selectedChat.chatId)}.json?auth=${encodeURIComponent(user.token)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lastMessageType:"text",lastMessageText:text,lastMessageAt:now,lastMessageSenderId:user.id})})]);setConversationMessages(old=>[...old,{id:result.name,...message}]);setSelectedChat(updated);setUserChats(old=>({...old,[updated.chatId]:updated}));setMessageDraft("");}catch(error){Alert.alert("Message",error.message||"Message send nahi hua.");}finally{setMessageSendingText(false);}
  }

  function renderProfile() {
    const viewingOther=!!selectedProfileId&&selectedProfileId!==user?.id;
    const shownProfile=viewingOther?(selectedProfileData||userProfiles[selectedProfileId]||{}):{username,bio,location,profileImage,coverImage};
    const shownUsername=shownProfile.username||"User";
    const shownPosts=viewingOther?posts.filter(post=>post.ownerId===selectedProfileId&&post.privacy!=="Private"&&isRealVideoPost(post)):myPosts;
    const profileVideos=viewingOther?shownPosts:(profileTab==="Videos"?myPublicPosts:profileTab==="Private"?privatePosts:profileTab==="Reposted"?myRepostedPosts:allReels.filter(post=>!!liked[post.id]&&isRealVideoPost(post)));

    if(viewingOther) {
      const otherYoutube=String(shownProfile.youtubeLink||"").trim();
      const openOtherYoutube=()=>{
        if(!otherYoutube)return Alert.alert("YouTube","Is user ne abhi YouTube channel link add nahi kiya.");
        const url=otherYoutube.startsWith("http")?otherYoutube:`https://${otherYoutube}`;
        Linking.openURL(url).catch(()=>Alert.alert("YouTube","YouTube channel open nahi hua."));
      };
      const otherFollowing=!!following[selectedProfileId];
      const otherLikes=shownPosts.reduce((total,post)=>total+(likeCounts[post.id]||0),0);
      return (
        <ScrollView style={styles.pageScroll} contentContainerStyle={{paddingBottom:24}}>
          <View style={{height:52,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16}}>
            <TouchableOpacity onPress={()=>{setSelectedProfileId(null);setSelectedProfileData(null);setPage("Home");}}><Text style={styles.profileTopIcon}>‹</Text></TouchableOpacity>
            <Text style={styles.profileTopUsername}>@{shownUsername}</Text>
            <TouchableOpacity onPress={()=>Share.share({message:`Check out @${shownUsername} on Gen Video Live!`})}><Text style={{fontSize:24,color:C.white}}>↗</Text></TouchableOpacity>
          </View>
          {shownProfile.coverImage?<Image source={{uri:shownProfile.coverImage}} style={{width:"100%",height:118,resizeMode:"cover"}}/>:null}
          <View style={{paddingHorizontal:18,paddingTop:18}}>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
              <View style={{flex:1,paddingRight:12}}>
                <Text style={{color:C.white,fontSize:23,fontWeight:"900"}}>{shownUsername}</Text>
                <Text style={{color:C.gray,fontSize:13,marginTop:4}}>@{String(shownUsername).replace(/^@/,"")}</Text>
              </View>
              <View style={{width:92,height:92,borderRadius:46,backgroundColor:C.card2,borderWidth:1,borderColor:C.magenta,overflow:"hidden",alignItems:"center",justifyContent:"center"}}>
                {shownProfile.profileImage?<Image source={{uri:shownProfile.profileImage}} style={{width:"100%",height:"100%"}}/>:<Text style={{fontSize:34}}>👤</Text>}
              </View>
            </View>
            <View style={{flexDirection:"row",justifyContent:"space-between",marginTop:22,marginBottom:18}}>
              <View style={{flex:1}}><Text style={{color:C.white,fontSize:20,fontWeight:"900"}}>{Number(shownProfile.followingCount||0)}</Text><Text style={{color:C.gray,fontSize:12}}>Following</Text></View>
              <View style={{flex:1}}><Text style={{color:C.white,fontSize:20,fontWeight:"900"}}>{selectedProfileFollowerCount}</Text><Text style={{color:C.gray,fontSize:12}}>Followers</Text></View>
              <View style={{flex:1}}><Text style={{color:C.white,fontSize:20,fontWeight:"900"}}>{otherLikes}</Text><Text style={{color:C.gray,fontSize:12}}>Likes</Text></View>
            </View>
            <View style={{flexDirection:"row",gap:8,marginBottom:17}}>
              <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed,{paddingVertical:12}]} onPress={()=>toggleFollow({ownerId:selectedProfileId,creator:shownUsername})}><Text style={styles.profileActionText}>{otherFollowing?"Following":"Follow"}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.profileActionButton,{backgroundColor:"#efeff2",paddingVertical:12}]} onPress={()=>openDirectMessage(selectedProfileId,shownProfile)}><Text style={{color:"#111",fontSize:12,fontWeight:"900"}}>Message</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.profileActionButton,{backgroundColor:"#efeff2",paddingVertical:12}]} onPress={openOtherYoutube}><Text style={{color:"#111",fontSize:12,fontWeight:"900"}}>▶ YouTube</Text></TouchableOpacity>
            </View>
            {!!shownProfile.bio&&<Text style={{color:C.white,fontSize:14,lineHeight:20,marginBottom:10}}>{shownProfile.bio}</Text>}
            {!!shownProfile.location&&<Text style={{color:C.gray,fontSize:12,marginBottom:12}}>📍 {shownProfile.location}</Text>}
          </View>
          <View style={{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#302d43",marginTop:4}}>
            <View style={{flex:1,alignItems:"center",paddingVertical:12,borderBottomWidth:3,borderBottomColor:C.pink}}><Text style={{color:C.white,fontSize:13,fontWeight:"800"}}>▦ Videos</Text></View>
          </View>
          {profileVideos.length>0?(
            <View style={styles.videoGrid}>
              {profileVideos.map(item=>(
                <TouchableOpacity key={item.id} style={styles.videoGridItem} onPress={()=>{if(item.videoUrl){recordPostView(item);setPlayingPost(item);}else Alert.alert("Video unavailable","Yeh video abhi play nahi ho sakti.");}}>
                  <View style={styles.videoGridPlaceholder}>
                    {getVideoThumbnail(item)?<Image source={{uri:getVideoThumbnail(item)}} style={styles.videoGridThumbnail}/>:<View style={styles.videoGridNoThumbnail}/>}
                    <View style={styles.videoGridOverlay}><View style={styles.videoGridViewBadge}><Text style={styles.videoGridViewText}>▷ {Object.keys(item.viewsByUser||{}).length}</Text></View></View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ):(
            <View style={styles.emptyProfileVideos}><Text style={styles.emptyProfileTitle}>No public videos yet</Text><Text style={styles.emptyText}>Is user ki public videos yahan nazar aayengi.</Text></View>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.profilePageContent}>
        <View style={styles.profileTopBar}>
          <TouchableOpacity onPress={()=>{setSelectedProfileId(null);setSelectedProfileData(null);setPage("Home");}}><Text style={styles.profileTopIcon}>‹</Text></TouchableOpacity>
          <Text style={styles.profileTopUsername}>@{shownUsername}</Text>
          {!viewingOther&&<TouchableOpacity accessibilityRole="button" accessibilityLabel="Open Settings" style={styles.gearButton} onPress={()=>setPage("Settings")}><Text style={{fontSize:27,color:C.white}}>☰</Text></TouchableOpacity>}
        </View>

        <View style={styles.profileCoverWrap}>
          {shownProfile.coverImage ? (
            <Image source={{uri:shownProfile.coverImage}} style={styles.profileCoverImage}/>
          ) : (
            <View style={styles.profileCoverPlaceholder}/>
          )}
        </View>

        <View style={styles.profileMain}>
          <View style={styles.profileAvatarBig}>
            {shownProfile.profileImage ? (
              <Image source={{uri:shownProfile.profileImage}} style={styles.profileAvatarImage}/>
            ) : (
              <Text style={{fontSize:42}}>👤</Text>
            )}
          </View>
          <Text style={styles.profileName}>@{shownUsername}</Text>
          {shownProfile.location ? <Text style={styles.profileLocation}>📍 {shownProfile.location}</Text> : null}
          <Text style={styles.profileBio}>{shownProfile.bio||"Welcome to my Gen Video Live profile! 👑"}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNumber}>{shownPosts.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{viewingOther?selectedProfileFollowerCount:followerCount}</Text><Text style={styles.statLabel}>Followers</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{viewingOther?Number(shownProfile.followingCount||0):Object.keys(following).length}</Text><Text style={styles.statLabel}>Following</Text></View>
            <View style={styles.statDivider}/>
            <View style={styles.stat}><Text style={styles.statNumber}>{shownPosts.reduce((total,post)=>total+(likeCounts[post.id]||0),0)}</Text><Text style={styles.statLabel}>Likes</Text></View>
          </View>

          <View style={styles.profileButtons}>
            {viewingOther ? (
              <>
                <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed]} onPress={()=>openDirectMessage(selectedProfileId,shownProfile)}><Text style={styles.profileActionText}>Message</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed]} onPress={()=>toggleFollow({ownerId:selectedProfileId,creator:shownUsername})}><Text style={styles.profileActionText}>{following[selectedProfileId]?"Following":"Follow"}</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed]} onPress={()=>{setEditUsername(username);setEditBio(bio);setEditLocation(location);setEditProfileImage(profileImage);setEditCoverImage(coverImage);setEditYoutubeLink(youtubeLink);setPage("EditProfile");}}><Text style={styles.profileActionText}>Edit Profile</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed]} onPress={()=>youtubeLink?Linking.openURL(youtubeLink.startsWith("http")?youtubeLink:`https://${youtubeLink}`).catch(()=>Alert.alert("YouTube","YouTube link open nahi hua.")):Alert.alert("YouTube","Edit Profile mein pehle apna YouTube channel link save karein.")}>
                  <Text style={styles.profileActionText}>▶ YouTube</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.profileActionButton,styles.profileActionButtonRed]} onPress={()=>Share.share({message:`Check out @${shownUsername} on Gen Video Live!`})}><Text style={styles.profileActionText}>Share Profile</Text></TouchableOpacity>
          </View>
        </View>

        {!viewingOther&&<View style={styles.profileTabBar}>
          {["Videos","Reposted","Liked","Private"].map(tab=>(
            <TouchableOpacity
              key={tab}
              style={styles.profileTab}
              onPress={()=>setProfileTab(tab)}
            >
              <Text style={[styles.profileTabText,profileTab===tab&&styles.profileTabActive]}>
                {tab==="Videos"?"▦ Videos":tab==="Reposted"?"🔁 Reposted":tab==="Liked"?"♡ Liked":"🔒 Private"}
              </Text>
              {profileTab===tab&&<View style={styles.profileTabUnderline}/>}
            </TouchableOpacity>
          ))}
        </View>}

        {profileVideos.length>0?(
          <View style={styles.videoGrid}>
            {profileVideos.map(item=>(
              <TouchableOpacity
                key={item.id}
                style={styles.videoGridItem}
                onPress={()=>{
                  if(item.videoUrl) { recordPostView(item); setPlayingPost(item); }
                  else Alert.alert("Sample Reel","Yeh demo video player se nahi chalegi.");
                }}
              >
                <View style={styles.videoGridPlaceholder}>
                  {getVideoThumbnail(item) ? (
                    <Image source={{uri:getVideoThumbnail(item)}} style={styles.videoGridThumbnail}/>
                  ) : (
                    <View style={styles.videoGridNoThumbnail}/>
                  )}
                  <View style={styles.videoGridOverlay}>
                    {item.ownerId===user?.id&&profileTab!=="Liked"&&profileTab!=="Reposted"&&(
                      <TouchableOpacity
                        style={styles.profileDeleteButton}
                        onPress={()=>confirmDeletePost(item)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete your post"
                      >
                        <Text style={styles.profileDeleteText}>•••</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.videoGridViewBadge}>
                      <Text style={styles.videoGridViewText}>▷ {Object.keys(item.viewsByUser||{}).length}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ):(
          <View style={styles.emptyProfileVideos}>
            <Text style={{fontSize:42}}>
              {profileTab==="Private"?"🔒":profileTab==="Liked"?"❤️":profileTab==="Reposted"?"🔁":"🎬"}
            </Text>
            <Text style={styles.emptyProfileTitle}>
              {profileTab==="Videos"?"No videos yet":profileTab==="Liked"?"No liked videos":profileTab==="Reposted"?"No reposts yet":"No private videos"}
            </Text>
            <Text style={styles.smallMuted}>
              {profileTab==="Liked"?"Videos you like will appear here.":profileTab==="Reposted"?"Videos you repost will appear here.":"Your uploaded videos will appear here."}
            </Text>
            {profileTab==="Videos"&&<Button title="＋ Create Video" onPress={()=>{setCreateStep("camera");setPage("Create");}}/>}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderVideoPlayer() {
    if(!playingPost) return null;
    const reel=playingPost;
    return (
      <View style={styles.playerScreen}>
        <ReelCard
          reel={reel}
          height={SCREEN_HEIGHT-58}
          isActive={true}
          liked={!!liked[reel.id]}
          saved={!!saved[reel.id]}
          likeCount={likeCounts[reel.id]??Number(reel.likes||0)}
          following={!!(reel.ownerId&&following[reel.ownerId])}
          onLike={()=>toggleLike(reel.id)}
          onDoubleLike={()=>{if(!liked[reel.id]) toggleLike(reel.id);}}
          onSave={()=>toggleSave(reel.id)}
          onFollow={()=>toggleFollow(reel)}
          onComment={()=>openComments(reel)}
          onQuickReaction={(emoji)=>postQuickReaction(reel,emoji)}
          shareCount={shareCounts[reel.id]||0}
          repostCount={repostCounts[reel.id]||0}
          reposted={!!myReposts[reel.id]}
          onShare={()=>shareReel(reel)}
          onRepost={()=>toggleRepost(reel)}
          onSound={()=>openSound(reel)}
          isOwner={reel.ownerId===user?.id}
          onDelete={()=>confirmDeletePost(reel)}
        />
        <TouchableOpacity onPress={()=>setPlayingPost(null)} style={styles.playerBackOverlay}>
          <Text style={styles.playerBackOverlayText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.playerViewsBar}>
          <Text style={styles.playerViewsText}>▷ {Object.keys(reel.viewsByUser||{}).length.toLocaleString()} views</Text>
          {reel.ownerId===user?.id&&(
            <TouchableOpacity style={styles.playerInsightsButton} onPress={()=>Alert.alert("Video insights", "Total views: "+Object.keys(reel.viewsByUser||{}).length)}>
              <Text style={styles.playerInsightsText}>▣ More insights</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  function renderEditProfile() {
    return (
      <KeyboardAvoidingView style={styles.pageScroll} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={()=>setPage("Profile")}><Text style={styles.backText}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>Edit Profile</Text>

          <Text style={styles.fieldLabel}>Cover Image</Text>
          <TouchableOpacity style={styles.editCoverPreview} onPress={chooseCoverImage}>
            {editCoverImage ? (
              <Image source={{uri:editCoverImage}} style={styles.editCoverImage}/>
            ) : (
              <Text style={styles.imagePickerText}>＋ Choose Cover Image</Text>
            )}
          </TouchableOpacity>
          <Button title="Change Cover Image" secondary onPress={chooseCoverImage}/>

          <Text style={styles.fieldLabel}>Profile Image</Text>
          <TouchableOpacity style={styles.editAvatarPreview} onPress={chooseProfileImage}>
            {editProfileImage ? (
              <Image source={{uri:editProfileImage}} style={styles.editAvatarImage}/>
            ) : (
              <Text style={{fontSize:38}}>👤</Text>
            )}
          </TouchableOpacity>
          <Button title="Change Profile Image" secondary onPress={chooseProfileImage}/>

          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput style={styles.input} value={editUsername} onChangeText={setEditUsername} placeholder="Your username" placeholderTextColor={C.gray} autoCapitalize="none"/>

          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput style={[styles.input,{height:100,textAlignVertical:"top"}]} value={editBio} onChangeText={setEditBio} multiline placeholder="Your bio" placeholderTextColor={C.gray}/>

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} value={editLocation} onChangeText={setEditLocation} placeholder="Your location" placeholderTextColor={C.gray}/>

          <Text style={styles.fieldLabel}>YouTube Channel Link</Text>
          <TextInput style={styles.input} value={editYoutubeLink} onChangeText={setEditYoutubeLink} placeholder="https://www.youtube.com/@YourChannel" placeholderTextColor={C.gray} autoCapitalize="none" autoCorrect={false} keyboardType="url"/>

          <Button title={loading?"Saving...":"Save Profile"} onPress={saveProfile} disabled={loading}/>
          {loading&&<ActivityIndicator color={C.magenta} style={{marginTop:12}}/>}
          <Button title="Cancel" secondary onPress={()=>setPage("Profile")}/>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderSound() {
    const soundReels=allReels.filter(reel=>soundSourcePostId ? (reel.id===soundSourcePostId||reel.soundSourcePostId===soundSourcePostId) : (reel.music||"Original Sound")===soundTitle);
    const filteredSoundReels=soundReels.filter(reel=>{
      const q=soundSearchText.trim().toLowerCase();
      return !q || (reel.caption||"").toLowerCase().includes(q) || (reel.creator||"").toLowerCase().includes(q);
    });
    const sourceReel=soundReels.find(reel=>reel.id===soundSourcePostId)||soundReels[0];
    const soundDuration=sourceReel?.duration ? Math.round(Number(sourceReel.duration))+"s" : "Original sound";
    const soundImage=soundAvatarUrl||sourceReel?.coverUrl||"";

    return (
      <View style={{flex:1,backgroundColor:"#fff"}}>
        <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:18}}>
          <View style={{height:62,flexDirection:"row",alignItems:"center",paddingHorizontal:16,gap:12}}>
            <TouchableOpacity onPress={()=>setPage(soundReturnPage)} style={{width:34,height:42,justifyContent:"center"}}><Text style={{fontSize:34,color:"#111",lineHeight:38}}>‹</Text></TouchableOpacity>
            <View style={{flex:1,height:44,borderWidth:1.5,borderColor:"#999",borderRadius:13,flexDirection:"row",alignItems:"center",paddingHorizontal:12,gap:8}}>
              <Text style={{fontSize:22,color:"#555"}}>⌕</Text>
              <TextInput value={soundSearchText} onChangeText={setSoundSearchText} placeholder={soundTitle} placeholderTextColor="#888" style={{flex:1,color:"#111",fontSize:15,padding:0}}/>
            </View>
            <TouchableOpacity onPress={()=>Share.share({message:`${soundTitle} by @${soundCreator} on Gen Video Live`})} style={{width:34,alignItems:"center"}}><Text style={{fontSize:27,color:"#111"}}>↗</Text></TouchableOpacity>
          </View>

          <View style={{paddingHorizontal:22,paddingTop:20,paddingBottom:14}}>
            <View style={{flexDirection:"row",alignItems:"center",gap:18}}>
              <View style={{width:116,height:116,borderRadius:58,borderWidth:5,borderColor:"#12c9df",padding:4,backgroundColor:"#fff"}}>
                <View style={{flex:1,borderRadius:50,borderWidth:4,borderColor:"#19d5a6",overflow:"hidden",backgroundColor:"#292033",alignItems:"center",justifyContent:"center"}}>
                  {soundImage?<Image source={{uri:soundImage}} style={{width:"100%",height:"100%"}}/>:<Text style={{fontSize:38}}>🎵</Text>}
                </View>
              </View>
              <View style={{flex:1}}>
                <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                  <Text style={{color:"#111",fontSize:22,fontWeight:"900",lineHeight:28,flex:1}} numberOfLines={3}>{soundTitle}</Text>
                  {sourceReel&&(sourceReel.ownerId===user?.id||sourceReel.userId===user?.id)?<TouchableOpacity onPress={()=>{setRenameSoundText(soundTitle);setRenameSoundOpen(v=>!v);}} style={{width:36,height:36,borderRadius:18,backgroundColor:"#f0f0f0",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:19,color:"#111"}}>✎</Text></TouchableOpacity>:null}
                </View>
                <Text style={{color:"#888",fontSize:16,marginTop:7}}>{soundCreator}</Text>
              </View>
            </View>
            {renameSoundOpen?<View style={{marginTop:14,padding:12,borderRadius:12,backgroundColor:"#f3f3f3",gap:9}}>
              <Text style={{color:"#111",fontSize:14,fontWeight:"800"}}>Sound ka naya naam</Text>
              <TextInput value={renameSoundText} onChangeText={setRenameSoundText} placeholder="Sound name" placeholderTextColor="#888" maxLength={60} style={{height:46,borderRadius:10,borderWidth:1,borderColor:"#bbb",paddingHorizontal:12,color:"#111",backgroundColor:"#fff"}}/>
              <View style={{flexDirection:"row",gap:8}}>
                <TouchableOpacity onPress={()=>setRenameSoundOpen(false)} style={{flex:1,height:42,borderRadius:10,backgroundColor:"#ddd",alignItems:"center",justifyContent:"center"}}><Text style={{color:"#111",fontWeight:"800"}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity disabled={renamingSound||!renameSoundText.trim()} onPress={async()=>{
                  const nextName=renameSoundText.trim();
                  if(!nextName)return;
                  setRenamingSound(true);
                  try {
                    const sourceId=sourceReel?.id||soundSourcePostId;
                    if(sourceId&&user?.token) {
                      const response=await fetch(DATABASE_URL+"/posts/"+sourceId+".json?auth="+encodeURIComponent(user.token),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({music:nextName})});
                      if(!response.ok)throw new Error("Sound ka naam save nahi ho saka.");
                      setPosts(old=>old.map(post=>post.id===sourceId?{...post,music:nextName}:post));
                    }
                    setSoundTitle(nextName);
                    setRenameSoundOpen(false);
                    Alert.alert("Saved","Sound ka naya naam save ho gaya.");
                  } catch(error){Alert.alert("Save Error",error.message||"Sound name save nahi hua.");}
                  finally{setRenamingSound(false);}
                }} style={{flex:1,height:42,borderRadius:10,backgroundColor:"#ff2458",alignItems:"center",justifyContent:"center",opacity:renamingSound||!renameSoundText.trim()?0.55:1}}><Text style={{color:"#fff",fontWeight:"900"}}>{renamingSound?"Saving...":"Save Name"}</Text></TouchableOpacity>
              </View>
            </View>:null}
            <View style={{flexDirection:"row",alignItems:"center",marginTop:28,gap:9}}>
              <Text style={{color:"#111",fontSize:16}}>▶ {soundDuration}</Text>
              <View style={{height:24,width:1,backgroundColor:"#ccc"}}/>
              <Text style={{color:"#111",fontSize:15,flex:1}} numberOfLines={1}>Original sound by: <Text style={{fontWeight:"800"}}>{soundCreator}</Text></Text>
              <Text style={{color:"#888",fontSize:13}}>{soundReels.length} posts</Text>
            </View>
            <View style={{flexDirection:"row",gap:10,marginTop:23}}>
              <TouchableOpacity onPress={()=>Alert.alert("Jam Sound","Jam Sound feature abhi available nahi hai.")} style={{flex:1,height:52,borderRadius:28,backgroundColor:"#f0f0f0",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7}}>
                <Text style={{fontSize:21,color:"#111"}}>♫</Text><Text style={{fontSize:15,fontWeight:"800",color:"#111"}}>Jam Sound</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setSoundSaved(v=>!v)} style={{flex:1,height:52,borderRadius:28,backgroundColor:"#f0f0f0",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7}}>
                <Text style={{fontSize:21,color:"#111"}}>{soundSaved?"♥":"♧"}</Text><Text style={{fontSize:15,fontWeight:"800",color:"#111"}}>{soundSaved?"Saved":"Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{height:1,backgroundColor:"#eee",marginTop:4}}/>
          <View style={{paddingHorizontal:12,paddingTop:16}}>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:3,paddingBottom:12}}>
              <Text style={{fontSize:18,fontWeight:"900",color:"#111"}}>Videos using this sound</Text>
              <Text style={{fontSize:12,color:"#888"}}>{filteredSoundReels.length} videos</Text>
            </View>
            {filteredSoundReels.length>0?<View style={{flexDirection:"row",flexWrap:"wrap",gap:2}}>
              {filteredSoundReels.map(reel=>(
                <TouchableOpacity key={reel.id} onPress={()=>{setPlayingPost(reel);setPage("Home");setFeedTab("For You");}} style={{width:"32.9%",aspectRatio:0.72,backgroundColor:"#ddd",overflow:"hidden"}}>
                  {getVideoThumbnail(reel)?<Image source={{uri:getVideoThumbnail(reel)}} style={{width:"100%",height:"100%"}} resizeMode="cover"/>:<View style={{flex:1,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:30}}>🎬</Text></View>}
                  {reel.id===soundSourcePostId?<View style={{position:"absolute",top:7,left:6,backgroundColor:"#ff315f",paddingHorizontal:7,paddingVertical:3,borderRadius:5}}><Text style={{color:"#fff",fontSize:10,fontWeight:"900"}}>Original</Text></View>:null}
                  <View style={{position:"absolute",left:6,bottom:7,flexDirection:"row",alignItems:"center",gap:4}}><Text style={{color:"#fff",fontSize:12,fontWeight:"900",textShadowColor:"#000",textShadowRadius:4}}>▶ {reel.views||0}</Text></View>
                </TouchableOpacity>
              ))}
            </View>:<Text style={{color:"#777",textAlign:"center",paddingVertical:35}}>Is sound ke saath videos yahan show hongi.</Text>}
          </View>
        </ScrollView>
        <View style={{height:Platform.OS==="android"?104:84,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#eee",paddingHorizontal:16,paddingTop:10,paddingBottom:Platform.OS==="android"?30:8,flexDirection:"row",gap:10}}>
          <TouchableOpacity onPress={()=>setSoundSaved(v=>!v)} style={{flex:1,borderRadius:28,backgroundColor:"#f1f1f1",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7}}>
            <Text style={{fontSize:19,color:"#111"}}>♫</Text><Text style={{fontSize:16,fontWeight:"900",color:"#111"}}>Jam Sound</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>{setSelectedSound(soundTitle);setSelectedSoundVolume(100);setOriginalVideoVolume(0);setPage("Create");setCreateStep("camera");chooseVideoFromGallery();}} style={{flex:1,borderRadius:28,backgroundColor:"#ff2458",alignItems:"center",justifyContent:"center",flexDirection:"row",gap:7}}>
            <Text style={{fontSize:19,color:"#fff"}}>▣</Text><Text style={{fontSize:16,fontWeight:"900",color:"#fff"}}>Use sound</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderSettings() {
    return (
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <TouchableOpacity onPress={()=>setPage("Profile")}><Text style={styles.backText}>‹ Back to Profile</Text></TouchableOpacity>
        <Text style={styles.pageTitle}>Settings</Text>

        <View style={styles.accountCard}>
          <View style={styles.settingsAvatar}><Text style={{fontSize:28}}>👤</Text></View>
          <View style={{flex:1}}>
            <Text style={styles.accountName}>{username}</Text>
            <Text style={styles.accountEmail}>{user?.email}</Text>
          </View>
        </View>

        {[
          ["🔔","Notifications"],
          ["🔐","Privacy & Security"],
          ["🚫","Blocked Users"],
          ["🌙","Appearance / Dark Mode"],
          ["🌐","App Language"],
          ["📦","Data & Storage"],
          ["❓","Help & Support"]
        ].map(item=>(
          <TouchableOpacity key={item[1]} style={styles.settingRow} onPress={()=>item[1]==="App Language"?openLanguagePicker():showPlaceholder(item[1])}>
            <Text style={styles.settingIcon}>{item[0]}</Text>
            <View style={{flex:1}}>
              <Text style={styles.settingTitle}>{item[1]}</Text>
              {item[1]==="App Language"&&<Text style={styles.smallMuted}>{appLanguage==="auto"?"Automatic (device)":appLanguage}</Text>}
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>🚪 Log Out</Text>
        </TouchableOpacity>
        <Text style={styles.smallMuted}>Gen Video Live • Version 1.0</Text>
      </ScrollView>
    );
  }

  if(showIntro) return (
    <View style={styles.launchScreen}>
      <StatusBar backgroundColor="#000000" barStyle="light-content"/>
      <Image source={require("./assets/icon.png")} style={[styles.launchLogo,{width:220,height:220,marginBottom:24}]} resizeMode="contain"/>
      <Animated.Text style={[styles.introWord,{opacity:introGen,transform:[{translateY:introGen.interpolate({inputRange:[0,1],outputRange:[24,0]})},{scale:introGen.interpolate({inputRange:[0,1],outputRange:[0.72,1]})}]}]}>GEN</Animated.Text>
      <Animated.Text style={[styles.introWord,{color:"#58cfff",opacity:introVideo,transform:[{translateY:introVideo.interpolate({inputRange:[0,1],outputRange:[24,0]})},{scale:introVideo.interpolate({inputRange:[0,1],outputRange:[0.72,1]})}]}]}>VIDEO</Animated.Text>
      <Animated.Text style={[styles.introWord,{color:"#d9aaff",opacity:introLive,transform:[{translateY:introLive.interpolate({inputRange:[0,1],outputRange:[24,0]})},{scale:introLive.interpolate({inputRange:[0,1],outputRange:[0.72,1]})}]}]}>LIVE</Animated.Text>
      <Text style={styles.launchSubtitle}>WATCH • CREATE • CONNECT</Text>
    </View>
  );

  if(sessionLoading) return (
    <View style={styles.launchScreen}>
      <StatusBar backgroundColor="#100019" barStyle="light-content"/>
      <Image source={require("./assets/icon.png")} style={styles.launchLogo} resizeMode="contain"/>
      <Text style={styles.launchTitle}>GEN VIDEO LIVE</Text>
      <Text style={styles.launchSubtitle}>WATCH • CREATE • CONNECT</Text>
      <ActivityIndicator size="small" color={C.magenta} style={{marginTop:22}}/>
    </View>
  );

  if(!user) return renderLogin();

  if(playingPost) return (
    <View style={styles.app}>
      <StatusBar backgroundColor="#000" barStyle="light-content" hidden={true}/>
      {renderVideoPlayer()}
      <Modal visible={shareModalVisible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent={true} onRequestClose={()=>setShareModalVisible(false)}>
        <KeyboardAvoidingView style={styles.shareModalRoot} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={0}>
          <TouchableOpacity style={styles.shareBackdrop} activeOpacity={1} onPress={()=>setShareModalVisible(false)}/>
          <View style={styles.shareSheet}>
            <ScrollView style={styles.shareSheetScroll} contentContainerStyle={styles.shareSheetScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
              <View style={styles.shareSheetHeader}><Text style={styles.shareSheetTitle}>Share video</Text><TouchableOpacity onPress={()=>setShareModalVisible(false)}><Text style={styles.shareClose}>×</Text></TouchableOpacity></View>
              <Button title="↗ Share to WhatsApp / other apps" onPress={shareReelExternally}/>
              <Text style={styles.fieldLabel}>Optional message</Text>
              <TextInput style={styles.input} value={messageText} onChangeText={setMessageText} placeholder="Write a message..." placeholderTextColor={C.gray}/>
              <Text style={styles.fieldLabel}>Send to a Gen Video Live user</Text>
              <TextInput style={styles.input} value={recipientQuery} onChangeText={searchMessageRecipients} placeholder="Search username..." placeholderTextColor={C.gray}/>
              {recipientLoading?<ActivityIndicator color={C.magenta}/>:(
                <View>
                  {recipientResults.map(recipient=><TouchableOpacity key={recipient.id} style={styles.recipientRow} onPress={()=>sendVideoToRecipient(recipient)} disabled={messageSending}>
                    <View style={styles.inboxAvatar}>{recipient.profileImage?<Image source={{uri:recipient.profileImage}} style={styles.inboxAvatarImage}/>:<Text>👤</Text>}</View><Text style={styles.recipientName}>@{recipient.username}</Text>{messageSending?<ActivityIndicator color={C.magenta}/>:<Text style={styles.recipientSend}>Send ›</Text>}
                  </TouchableOpacity>)}
                  {!!recipientQuery.trim()&&!recipientResults.length&&<Text style={styles.smallMuted}>Koi user nahi mila. Username check karein.</Text>}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={commentsVisible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent={true} onRequestClose={()=>setCommentsVisible(false)}>
        <View style={styles.commentsModalRoot}>
          <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={()=>setCommentsVisible(false)}/>
          <KeyboardAvoidingView style={styles.commentsKeyboard} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={Platform.OS==="ios"?24:0}>
            <View style={styles.commentsSheet}>
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>{comments.length} comments</Text>
                <TouchableOpacity onPress={()=>setCommentsVisible(false)} style={styles.commentsClose}><Text style={styles.commentsCloseText}>×</Text></TouchableOpacity>
              </View>
              {commentsLoading ? <View style={styles.commentsLoading}><ActivityIndicator color={C.magenta}/><Text style={styles.commentsMuted}>Loading comments...</Text></View> : (
                <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent} keyboardShouldPersistTaps="handled">
                  {comments.map(comment=>(
                    <View key={comment.id} style={styles.commentRow}>
                      {comment.profileImage ? <Image source={{uri:comment.profileImage}} style={styles.commentAvatar}/> : <View style={styles.commentAvatarFallback}><Text>👤</Text></View>}
                      <View style={styles.commentBody}>
                        <View style={styles.commentNameRow}>
                          <Text style={styles.commentUsername}>{comment.username||"User"}</Text>
                          {comment.userId===commentPost?.ownerId&&<Text style={styles.commentCreatorBadge}>Creator</Text>}
                        </View>
                        {!!comment.text&&<Text style={styles.commentMessage}>{comment.text}</Text>}
                        {!!comment.imageUrl&&<Image source={{uri:comment.imageUrl}} style={styles.commentImage}/>}
                        <View style={styles.commentActions}>
                          <Text style={styles.commentDate}>{comment.createdAt?new Date(comment.createdAt).toLocaleDateString():""}</Text>
                          <TouchableOpacity onPress={()=>{setCommentText("@"+(comment.username||"User")+" ");commentInputRef.current?.focus();}}><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
                          {comment.userId===user?.id&&<TouchableOpacity onPress={()=>deleteComment(comment)}><Text style={styles.commentDeleteText}>Delete</Text></TouchableOpacity>}
                        </View>
                      </View>
                    </View>
                  ))}
                  {!comments.length&&<View style={styles.commentsEmpty}><Text style={{fontSize:34}}>💬</Text><Text style={styles.commentsMuted}>Abhi koi comment nahi. Pehla comment aap karein!</Text></View>}
                </ScrollView>
              )}
              <View style={styles.commentComposer}>
                {commentImage&&<View style={styles.commentImagePreviewRow}><Image source={{uri:commentImage.uri}} style={styles.commentImagePreview}/><TouchableOpacity onPress={()=>setCommentImage(null)}><Text style={styles.commentRemoveImage}>×</Text></TouchableOpacity></View>}
                <View style={styles.commentInputRow}>
                  {profileImage ? <Image source={{uri:profileImage}} style={styles.commentMyAvatar}/> : <View style={styles.commentMyAvatarFallback}><Text>👤</Text></View>}
                  <TextInput ref={commentInputRef} style={styles.commentInput} value={commentText} onChangeText={setCommentText} placeholder="Add comment..." placeholderTextColor="#92929c" multiline maxLength={1000} returnKeyType="default"/>
                  <TouchableOpacity style={styles.commentToolButton} onPress={chooseCommentImage}><Text style={styles.commentToolIcon}>▧</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.commentToolButton} onPress={()=>setCommentText(old=>old+"@")}><Text style={styles.commentToolIcon}>@</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.commentSendButton,(!commentText.trim()&&!commentImage)&&styles.commentSendDisabled]} onPress={()=>submitComment()} disabled={commentSending||(!commentText.trim()&&!commentImage)}>
                    {commentSending?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.commentSendText}>↑</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );

  return (
    <GestureHandlerRootView style={{flex:1}}>
    <View style={styles.app}>
      <StatusBar backgroundColor="#000" barStyle="light-content" hidden={page==="Create"&&createStep==="camera"}/>

      {page==="Home"&&renderHome()}
      {page==="Explore"&&renderExplore()}
      {page==="Inbox"&&renderInbox()}
      {page==="Create"&&renderCreate()}
      {page==="Profile"&&renderProfile()}
      {page==="EditProfile"&&renderEditProfile()}
      {page==="Sound"&&renderSound()}
      {page==="Settings"&&renderSettings()}

      <Modal visible={shareModalVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={()=>setShareModalVisible(false)}>
        <View style={styles.shareModalRoot}>
          <TouchableOpacity style={styles.shareBackdrop} activeOpacity={1} onPress={()=>setShareModalVisible(false)}/>
          <View style={styles.shareSheet}>
            <View style={styles.shareSheetHeader}><Text style={styles.shareSheetTitle}>Share video</Text><TouchableOpacity onPress={()=>setShareModalVisible(false)}><Text style={styles.shareClose}>×</Text></TouchableOpacity></View>
            <Button title="↗ Share to WhatsApp / other apps" onPress={shareReelExternally}/>
            <Text style={styles.fieldLabel}>Optional message</Text>
            <TextInput style={styles.input} value={messageText} onChangeText={setMessageText} placeholder="Write a message..." placeholderTextColor={C.gray}/>
            <Text style={styles.fieldLabel}>Send to a Gen Video Live user</Text>
            <TextInput style={styles.input} value={recipientQuery} onChangeText={searchMessageRecipients} placeholder="Search username..." placeholderTextColor={C.gray}/>
            {recipientLoading?<ActivityIndicator color={C.magenta}/>:<ScrollView style={{maxHeight:190}} keyboardShouldPersistTaps="handled">
              {recipientResults.map(recipient=><TouchableOpacity key={recipient.id} style={styles.recipientRow} onPress={()=>sendVideoToRecipient(recipient)} disabled={messageSending}>
                <View style={styles.inboxAvatar}>{recipient.profileImage?<Image source={{uri:recipient.profileImage}} style={styles.inboxAvatarImage}/>:<Text>👤</Text>}</View><Text style={styles.recipientName}>@{recipient.username}</Text>{messageSending?<ActivityIndicator color={C.magenta}/>:<Text style={styles.recipientSend}>Send ›</Text>}
              </TouchableOpacity>)}
              {!!recipientQuery.trim()&&!recipientResults.length&&<Text style={styles.smallMuted}>Koi user nahi mila. Username check karein.</Text>}
            </ScrollView>}
          </View>
        </View>
      </Modal>

      <Modal visible={commentsVisible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent={true} onRequestClose={()=>setCommentsVisible(false)}>
        <View style={styles.commentsModalRoot}>
          <TouchableOpacity style={styles.commentsBackdrop} activeOpacity={1} onPress={()=>setCommentsVisible(false)}/>
          <KeyboardAvoidingView style={styles.commentsKeyboard} behavior={Platform.OS==="ios"?"padding":"height"} keyboardVerticalOffset={Platform.OS==="ios"?24:0}>
            <View style={styles.commentsSheet}>
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>{comments.length} comments</Text>
                <TouchableOpacity onPress={()=>setCommentsVisible(false)} style={styles.commentsClose}><Text style={styles.commentsCloseText}>×</Text></TouchableOpacity>
              </View>
              {commentsLoading ? <View style={styles.commentsLoading}><ActivityIndicator color={C.magenta}/><Text style={styles.commentsMuted}>Loading comments...</Text></View> : (
                <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent} keyboardShouldPersistTaps="handled">
                  {comments.map(comment=>(
                    <View key={comment.id} style={styles.commentRow}>
                      {comment.profileImage ? <Image source={{uri:comment.profileImage}} style={styles.commentAvatar}/> : <View style={styles.commentAvatarFallback}><Text>👤</Text></View>}
                      <View style={styles.commentBody}>
                        <View style={styles.commentNameRow}>
                          <Text style={styles.commentUsername}>{comment.username||"User"}</Text>
                          {comment.userId===commentPost?.ownerId&&<Text style={styles.commentCreatorBadge}>Creator</Text>}
                        </View>
                        {!!comment.text&&<Text style={styles.commentMessage}>{comment.text}</Text>}
                        {!!comment.imageUrl&&<Image source={{uri:comment.imageUrl}} style={styles.commentImage}/>}
                        <View style={styles.commentActions}>
                          <Text style={styles.commentDate}>{comment.createdAt?new Date(comment.createdAt).toLocaleDateString():""}</Text>
                          <TouchableOpacity onPress={()=>{setCommentText("@"+(comment.username||"User")+" ");commentInputRef.current?.focus();}}><Text style={styles.commentActionText}>Reply</Text></TouchableOpacity>
                          {comment.userId===user?.id&&<TouchableOpacity onPress={()=>deleteComment(comment)}><Text style={styles.commentDeleteText}>Delete</Text></TouchableOpacity>}
                        </View>
                      </View>
                    </View>
                  ))}
                  {!comments.length&&<View style={styles.commentsEmpty}><Text style={{fontSize:34}}>💬</Text><Text style={styles.commentsMuted}>Abhi koi comment nahi. Pehla comment aap karein!</Text></View>}
                </ScrollView>
              )}
              <View style={styles.commentComposer}>
                {commentImage&&<View style={styles.commentImagePreviewRow}><Image source={{uri:commentImage.uri}} style={styles.commentImagePreview}/><TouchableOpacity onPress={()=>setCommentImage(null)}><Text style={styles.commentRemoveImage}>×</Text></TouchableOpacity></View>}
                <View style={styles.commentInputRow}>
                  {profileImage ? <Image source={{uri:profileImage}} style={styles.commentMyAvatar}/> : <View style={styles.commentMyAvatarFallback}><Text>👤</Text></View>}
                  <TextInput ref={commentInputRef} style={styles.commentInput} value={commentText} onChangeText={setCommentText} placeholder="Add comment..." placeholderTextColor="#92929c" multiline maxLength={1000} returnKeyType="default"/>
                  <TouchableOpacity style={styles.commentToolButton} onPress={chooseCommentImage}><Text style={styles.commentToolIcon}>▧</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.commentToolButton} onPress={()=>setCommentText(old=>old+"@")}><Text style={styles.commentToolIcon}>@</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.commentSendButton,(!commentText.trim()&&!commentImage)&&styles.commentSendDisabled]} onPress={()=>submitComment()} disabled={commentSending||(!commentText.trim()&&!commentImage)}>
                    {commentSending?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.commentSendText}>↑</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {page!=="EditProfile"&&page!=="Sound"&&page!=="Settings"&&!(page==="Inbox"&&selectedChat&&chatInputFocused)&&!(page==="Create"&&(createStep==="gallery"||createStep==="camera"||createStep==="selected"))&&(
        <View style={styles.bottomNav}>
          <NavItem icon="home" label="Home" active={page==="Home"} onPress={()=>setPage("Home")}/>
          <NavItem icon="friends" label="Friends" active={page==="Explore"} onPress={()=>setPage("Explore")}/>
          <NavItem icon="create" label="Create+" active={page==="Create"} onPress={()=>{setCreateStep("camera");setPage("Create");}}/>
          <NavItem icon="inbox" label="Inbox" active={page==="Inbox"} onPress={()=>{setPage("Inbox");loadSocialRecords();}}/>
          <NavItem
            icon="profile"
            label="Profile"
            active={page==="Profile"}
            onPress={()=>{
              setSelectedProfileId(null);
              setSelectedProfileData(null);
              setPage("Profile");
              loadMyProfile();
              loadPosts();
              loadLikeSave();
            }}
          />
        </View>
      )}
    </View>
    </GestureHandlerRootView>
  );
}

// STYLES
const styles=StyleSheet.create({
  app:{flex:1,backgroundColor:C.bg,paddingTop:Platform.OS==="android"?(StatusBar.currentHeight||24):0,paddingBottom:Platform.OS==="android"?24:0},
  launchScreen:{flex:1,backgroundColor:"#100019",alignItems:"center",justifyContent:"center",padding:24},
  launchLogo:{width:150,height:150,marginBottom:18},
  launchTitle:{color:C.white,fontSize:24,fontWeight:"900",letterSpacing:2},
  launchSubtitle:{color:C.magenta,fontSize:11,fontWeight:"800",letterSpacing:2,marginTop:9},
  introWord:{color:"#ffffff",fontSize:34,fontWeight:"900",letterSpacing:7,marginTop:2,textShadowColor:"#258dff",textShadowRadius:16},
  screen:{flex:1,backgroundColor:C.bg},
  authScreen:{flex:1,backgroundColor:C.bg},
  authContent:{flexGrow:1,justifyContent:"center",padding:22,paddingBottom:42},
  crown:{fontSize:54,textAlign:"center",marginBottom:8},
  authTitle:{color:C.white,fontSize:30,fontWeight:"900",textAlign:"center"},
  authSubtitle:{color:C.magenta,textAlign:"center",marginTop:7,marginBottom:28},
  authCard:{backgroundColor:C.card,borderRadius:22,padding:20,borderWidth:1,borderColor:"#39334d"},
  sectionTitle:{color:C.white,fontSize:18,fontWeight:"800",marginBottom:14},
  input:{backgroundColor:"#121220",color:C.white,borderRadius:12,borderWidth:1,borderColor:"#37334a",paddingHorizontal:14,paddingVertical:13,marginBottom:13,fontSize:15},
  button:{backgroundColor:C.pink,borderRadius:13,paddingVertical:14,paddingHorizontal:16,alignItems:"center",justifyContent:"center",marginTop:10},
  secondaryButton:{backgroundColor:C.card2,borderWidth:1,borderColor:"#51435f"},
  buttonText:{color:C.white,fontWeight:"800",fontSize:15},
  switchText:{color:C.magenta,textAlign:"center",fontWeight:"700"},
  smallMuted:{color:C.gray,fontSize:12,marginTop:5},
  header:{height:62,paddingHorizontal:9,backgroundColor:C.bg,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#29283a"},
  headerOverlay:{position:"absolute",top:0,left:0,right:0,zIndex:10,backgroundColor:"transparent",borderBottomWidth:0},
  logo:{color:C.white,fontSize:14,fontWeight:"900"},
  headerTabs:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10,marginHorizontal:5},
  headerTabTouch:{alignItems:"center",justifyContent:"center"},
  headerTab:{color:C.gray,fontSize:11,fontWeight:"700",paddingVertical:10},
  headerTabActive:{color:C.white,fontSize:12},
  tabUnderline:{height:3,backgroundColor:C.pink,borderRadius:3,width:"75%"},
  searchButton:{width:27,alignItems:"center",justifyContent:"center"},
  searchIcon:{color:C.white,fontSize:27,fontWeight:"400",lineHeight:30},
  liveButton:{backgroundColor:"#321b31",borderRadius:9,paddingHorizontal:7,paddingVertical:8},
  liveText:{color:C.magenta,fontWeight:"900",fontSize:10},
  reelScroll:{flex:1},
  reelViewBadge:{position:"absolute",right:12,bottom:18,zIndex:5,backgroundColor:"rgba(0,0,0,0.48)",paddingHorizontal:7,paddingVertical:4,borderRadius:12},
  reelViewText:{color:C.white,fontSize:10,fontWeight:"800"},
  reelPage:{width:"100%",position:"relative",justifyContent:"center",overflow:"hidden"},
  reelVideo:{width:"100%",height:"100%",backgroundColor:"#000"},
  doubleTapArea:{position:"absolute",left:0,top:0,bottom:0,right:78,zIndex:1},
  doubleTapHeart:{position:"absolute",left:"38%",top:"39%",fontSize:92,zIndex:2,textShadowColor:"rgba(255,49,95,0.55)",textShadowOffset:{width:0,height:3},textShadowRadius:16},
  reelCenter:{flex:1,alignItems:"center",justifyContent:"center"},
  reelEmoji:{fontSize:100},
  demoLabel:{color:"rgba(255,255,255,0.78)",fontSize:13,fontWeight:"700",marginTop:10},
  reelBottom:{position:"absolute",left:15,right:88,bottom:25,zIndex:3},
  creatorName:{color:C.white,fontSize:15,fontWeight:"900"},
  caption:{color:C.white,fontSize:13,lineHeight:19,marginTop:8,marginBottom:11},
  audioLine:{flexDirection:"row",alignItems:"center",backgroundColor:"rgba(0,0,0,0.5)",alignSelf:"flex-start",paddingHorizontal:10,paddingVertical:7,borderRadius:20},
  musicNote:{color:C.magenta,fontSize:17,marginRight:7},
  music:{color:C.white,fontSize:12,fontWeight:"700",maxWidth:160},
  audioArrow:{color:C.white,marginLeft:8,fontSize:18},
  actionStack:{position:"absolute",right:8,bottom:16,alignItems:"center",gap:9,zIndex:4},
  postMoreButton:{width:34,height:30,borderRadius:15,backgroundColor:"rgba(0,0,0,0.58)",alignItems:"center",justifyContent:"center",marginBottom:2},
  postMoreText:{color:C.white,fontSize:16,fontWeight:"900",letterSpacing:1,lineHeight:18},
  profileDeleteButton:{position:"absolute",top:5,right:5,zIndex:5,width:27,height:25,borderRadius:13,backgroundColor:"rgba(0,0,0,0.72)",alignItems:"center",justifyContent:"center"},
  profileDeleteText:{color:C.white,fontSize:13,fontWeight:"900",letterSpacing:1},
  reactionDismissArea:{position:"absolute",top:-2000,left:-1000,right:-1000,bottom:-1000,zIndex:5},
  quickReactionPicker:{position:"absolute",right:58,bottom:235,zIndex:7,flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderRadius:40,paddingHorizontal:8,paddingVertical:7,elevation:12,shadowColor:"#000",shadowOpacity:0.25,shadowRadius:12,shadowOffset:{width:0,height:4}},
  quickReactionButton:{width:48,height:52,alignItems:"center",justifyContent:"center"},
  quickReactionEmoji:{fontSize:34},
  commentsModalRoot:{flex:1,justifyContent:"flex-end",paddingBottom:Platform.OS==="android"?30:0},
  commentsBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.58)"},
  commentsKeyboard:{width:"100%",maxHeight:"82%"},
  commentsSheet:{height:SCREEN_HEIGHT*0.68,maxHeight:SCREEN_HEIGHT*0.82,backgroundColor:"#fff",borderTopLeftRadius:22,borderTopRightRadius:22,overflow:"hidden"},
  commentsHeader:{height:52,alignItems:"center",justifyContent:"center",borderBottomWidth:1,borderBottomColor:"#eee"},
  commentsTitle:{color:"#171717",fontSize:16,fontWeight:"800"},
  commentsClose:{position:"absolute",right:12,top:7,width:36,height:36,alignItems:"center",justifyContent:"center"},
  commentsCloseText:{color:"#777",fontSize:29,lineHeight:32},
  commentsList:{flex:1},
  commentsListContent:{paddingHorizontal:15,paddingTop:14,paddingBottom:10},
  commentsLoading:{flex:1,alignItems:"center",justifyContent:"center"},
  commentsMuted:{color:"#777",fontSize:13,marginTop:7,textAlign:"center"},
  commentsEmpty:{paddingVertical:35,alignItems:"center",justifyContent:"center"},
  commentRow:{flexDirection:"row",alignItems:"flex-start",marginBottom:19,gap:10},
  commentAvatar:{width:40,height:40,borderRadius:20,backgroundColor:"#ddd"},
  commentAvatarFallback:{width:40,height:40,borderRadius:20,backgroundColor:"#eee",alignItems:"center",justifyContent:"center"},
  commentBody:{flex:1},
  commentNameRow:{flexDirection:"row",alignItems:"center",gap:7},
  commentUsername:{color:"#777",fontSize:13,fontWeight:"800"},
  commentCreatorBadge:{color:C.pink,fontSize:10,fontWeight:"800"},
  commentMessage:{color:"#171717",fontSize:15,lineHeight:21,marginTop:5},
  commentImage:{width:180,height:180,borderRadius:9,marginTop:8,resizeMode:"cover"},
  commentActions:{flexDirection:"row",alignItems:"center",gap:18,marginTop:9},
  commentDate:{color:"#999",fontSize:11},
  commentActionText:{color:"#777",fontSize:12,fontWeight:"800"},
  commentDeleteText:{color:"#d83b5c",fontSize:12,fontWeight:"800"},
  commentComposer:{backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#eee",paddingBottom:Platform.OS==="android"?10:18},
  commentEmojiRow:{paddingHorizontal:14,paddingTop:10,paddingBottom:8,justifyContent:"space-between",alignItems:"center",width:"100%"},
  commentEmojiButton:{width:48,height:42,alignItems:"center",justifyContent:"center"},
  commentEmoji:{fontSize:27},
  commentImagePreviewRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:15,paddingBottom:8,gap:10},
  commentImagePreview:{width:55,height:55,borderRadius:8},
  commentRemoveImage:{color:C.pink,fontSize:25,fontWeight:"800"},
  commentInputRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,gap:7},
  commentMyAvatar:{width:38,height:38,borderRadius:19},
  commentMyAvatarFallback:{width:38,height:38,borderRadius:19,backgroundColor:"#eee",alignItems:"center",justifyContent:"center"},
  commentInput:{flex:1,minHeight:48,maxHeight:100,backgroundColor:"#f1f1f1",borderRadius:23,paddingHorizontal:15,paddingVertical:12,color:"#111",fontSize:14,textAlignVertical:"center"},
  commentToolButton:{width:27,alignItems:"center",justifyContent:"center"},
  commentToolIcon:{color:"#111",fontSize:22,fontWeight:"800"},
  commentSendButton:{width:43,height:43,borderRadius:22,backgroundColor:C.pink,alignItems:"center",justifyContent:"center"},
  commentSendDisabled:{backgroundColor:"#e6a5b4"},
  commentSendText:{color:"#fff",fontSize:25,fontWeight:"900",lineHeight:28},
  creatorFollow:{alignItems:"center",marginBottom:2},
  creatorAvatarRing:{width:43,height:43,borderRadius:22,borderWidth:2,borderColor:C.gold,padding:2,backgroundColor:"#151522",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  creatorAvatarImage:{width:"100%",height:"100%",borderRadius:20},
  creatorAvatarFallback:{width:"100%",height:"100%",borderRadius:20,backgroundColor:"#39334d",alignItems:"center",justifyContent:"center"},
  avatarEmoji:{fontSize:21},
  followPlus:{width:21,height:21,borderRadius:11,backgroundColor:C.pink,alignItems:"center",justifyContent:"center",marginTop:-8,borderWidth:2,borderColor:C.bg,zIndex:2},
  followedButton:{backgroundColor:"#292638"},
  followPlusText:{color:C.white,fontSize:16,fontWeight:"900",lineHeight:18},
  actionButton:{alignItems:"center",minWidth:40},
  actionIcon:{fontSize:22,color:C.white},
  actionCount:{color:C.white,fontSize:9,fontWeight:"800",marginTop:2},
  bookmarkIcon:{width:16,height:20,borderWidth:2,borderBottomWidth:0,borderTopLeftRadius:2,borderTopRightRadius:2,position:"relative",marginTop:1},
  bookmarkCutLeft:{position:"absolute",width:9,height:2,bottom:1,left:-1,transform:[{rotate:38}]},
  bookmarkCutRight:{position:"absolute",width:9,height:2,bottom:1,right:-1,transform:[{rotate:-38}]},
  soundNameButton:{maxWidth:118,minHeight:38,paddingHorizontal:9,borderRadius:20,backgroundColor:"rgba(0,0,0,0.72)",borderWidth:1,borderColor:"rgba(255,255,255,0.35)",flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,marginTop:2,marginBottom:4},
  soundNameIcon:{color:C.white,fontSize:17,fontWeight:"900"},
  soundNameText:{color:C.white,fontSize:10,fontWeight:"900",maxWidth:82},
  disc:{width:42,height:42,borderRadius:21,backgroundColor:"#15151d",borderWidth:4,borderColor:"#393944",alignItems:"center",justifyContent:"center"},
  discCenter:{width:16,height:16,borderRadius:8,backgroundColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  discAvatar:{width:16,height:16,borderRadius:8},
  emptyFeed:{alignItems:"center",justifyContent:"center",padding:25,backgroundColor:C.bg},
  emptyText:{color:C.gray,textAlign:"center",marginTop:15,fontSize:14},
  bottomNav:{height:Platform.OS==="android"?90:66,paddingBottom:Platform.OS==="android"?24:0,backgroundColor:"#151522",borderTopWidth:1,borderTopColor:"#2b293b",flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingHorizontal:2},
  navItem:{alignItems:"center",justifyContent:"center",flex:1},
  navLabel:{fontSize:9,marginTop:5,fontWeight:"700"},
  navHomeIcon:{width:27,height:25,alignItems:"center",justifyContent:"flex-end"},
  navHomeRoof:{position:"absolute",top:1,width:17,height:17,borderLeftWidth:2.3,borderTopWidth:2.3,transform:[{rotate:45}],borderRadius:2},
  navHomeBody:{width:20,height:15,borderWidth:2.3,borderTopWidth:0,borderRadius:3,alignItems:"center",justifyContent:"flex-end"},
  navHomeDoor:{width:5,height:9,borderTopLeftRadius:2,borderTopRightRadius:2},
  navPeopleIcon:{width:29,height:26,position:"relative"},
  navPersonHead:{position:"absolute",top:1,width:9,height:9,borderRadius:5},
  navPersonHeadSmall:{position:"absolute",top:4,width:7,height:7,borderRadius:4,opacity:0.8},
  navPersonBody:{position:"absolute",bottom:0,width:18,height:12,borderTopLeftRadius:10,borderTopRightRadius:10},
  navPersonBodySmall:{position:"absolute",bottom:0,width:12,height:9,borderTopLeftRadius:8,borderTopRightRadius:8,opacity:0.8},
  navInboxIcon:{width:25,height:21,borderWidth:2.2,borderRadius:5,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  navInboxFlap:{position:"absolute",top:-7,width:15,height:15,borderLeftWidth:2,borderBottomWidth:2,transform:[{rotate:-45}]},
  navProfileIcon:{width:27,height:27,alignItems:"center",justifyContent:"flex-end"},
  navProfileHead:{position:"absolute",top:0,width:10,height:10,borderRadius:6,borderWidth:2.2},
  navProfileShoulders:{width:23,height:13,borderWidth:2.2,borderBottomWidth:0,borderTopLeftRadius:14,borderTopRightRadius:14},
  createNavIcon:{width:38,height:27,alignItems:"center",justifyContent:"center"},
  createNavBlue:{position:"absolute",width:34,height:25,borderRadius:7,backgroundColor:"#25f4ee",left:0,top:1},
  createNavPink:{position:"absolute",width:34,height:25,borderRadius:7,backgroundColor:"#fe2c55",right:0,top:1},
  createNavWhite:{width:34,height:25,borderRadius:7,backgroundColor:"#ffffff",alignItems:"center",justifyContent:"center"},
  createNavPlus:{fontSize:25,lineHeight:27,color:"#111111",fontWeight:"500",marginTop:-2},
  pageScroll:{flex:1,backgroundColor:C.bg},
  pageContent:{padding:16,paddingBottom:35},
  pageTitle:{color:C.white,fontSize:26,fontWeight:"900",marginBottom:7},
  pageSubtitle:{color:C.gray,marginBottom:18},
  card:{backgroundColor:C.card,borderRadius:18,padding:16,marginTop:14,borderWidth:1,borderColor:"#302d43"},
  buttonRow:{flexDirection:"row",gap:10,alignItems:"center"},
  galleryTab:{flex:1,paddingVertical:11,paddingHorizontal:5,borderRadius:10,backgroundColor:C.card2,alignItems:"center",borderWidth:1,borderColor:"#39334d"},
  galleryTabActive:{backgroundColor:"#48223f",borderColor:C.magenta},
  galleryTabText:{color:C.gray,fontSize:11,fontWeight:"700"},
  galleryTabTextActive:{color:C.white},
  selectedBox:{backgroundColor:"#172c2a",borderRadius:12,padding:12,marginTop:13},
  selectedTitle:{color:C.green,fontWeight:"800"},
  helpText:{color:C.gray,fontSize:12,lineHeight:18,marginTop:12},
  captionInput:{minHeight:90,textAlignVertical:"top"},
  soundSelect:{backgroundColor:"#121220",borderRadius:12,padding:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  soundSelectText:{color:C.white,fontWeight:"700"},
  fieldLabel:{color:C.gray,fontSize:13,fontWeight:"700",marginBottom:8,marginTop:15},
  uploadProgressBox:{backgroundColor:"#171729",borderRadius:13,padding:14,marginTop:15,borderWidth:1,borderColor:"#59304f"},
  uploadProgressHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  uploadProgressTitle:{color:C.white,fontSize:12,fontWeight:"700",flex:1,marginRight:8},
  uploadPercent:{color:C.magenta,fontSize:17,fontWeight:"900"},
  progressTrack:{height:9,backgroundColor:"#39334d",borderRadius:10,overflow:"hidden"},
  progressFill:{height:9,backgroundColor:C.magenta,borderRadius:10},
  uploadHint:{color:C.gray,fontSize:11,textAlign:"center",marginTop:8},
  profilePageContent:{paddingBottom:22},
  profileTopBar:{height:52,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:15},
  profileTopIcon:{color:C.white,fontSize:30,width:35},
  profileTopUsername:{color:C.white,fontWeight:"900",fontSize:17},
  gearButton:{width:48,height:48,borderRadius:24,backgroundColor:C.card2,alignItems:"center",justifyContent:"center"},
  profileCoverWrap:{height:155,width:"100%",backgroundColor:C.card2,overflow:"hidden"},
  profileCoverImage:{width:"100%",height:"100%",resizeMode:"cover"},
  profileCoverPlaceholder:{flex:1,backgroundColor:"#25253a"},
  profileMain:{alignItems:"center",paddingHorizontal:15,paddingTop:8},
  profileAvatarBig:{width:104,height:104,borderRadius:52,backgroundColor:C.card2,borderWidth:2,borderColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden",marginTop:-48},
  profileAvatarImage:{width:"100%",height:"100%",resizeMode:"cover"},
  profileName:{color:C.white,fontSize:20,fontWeight:"900",marginTop:10},
  profileEmail:{color:"#77778e",fontSize:11,marginTop:5},
  profileLocation:{color:C.gray,fontSize:12,marginTop:7},
  profileBio:{color:C.gray,textAlign:"center",marginTop:8,lineHeight:19,paddingHorizontal:15},
  statsRow:{flexDirection:"row",justifyContent:"space-around",alignItems:"center",width:"100%",backgroundColor:C.card,borderRadius:15,paddingVertical:15,marginTop:18},
  stat:{alignItems:"center",flex:1},
  statNumber:{color:C.white,fontSize:18,fontWeight:"900"},
  statLabel:{color:C.gray,fontSize:10,marginTop:4},
  statDivider:{height:27,width:1,backgroundColor:"#39364c"},
  profileButtons:{flexDirection:"row",width:"100%",gap:6,marginTop:14},
  profileActionButton:{flex:1,backgroundColor:C.card2,borderRadius:8,paddingVertical:8,alignItems:"center",justifyContent:"center"},
  profileActionButtonRed:{backgroundColor:"#d92f4b"},
  profileActionText:{color:C.white,fontSize:10,fontWeight:"800"},
  profileTabBar:{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#302d43",marginTop:20},
  profileTab:{flex:1,alignItems:"center",paddingVertical:12},
  profileTabText:{color:C.gray,fontSize:12,fontWeight:"700"},
  profileTabActive:{color:C.white},
  profileTabUnderline:{position:"absolute",bottom:0,height:3,width:"55%",backgroundColor:C.pink,borderRadius:3},
  videoGrid:{flexDirection:"row",flexWrap:"wrap"},
  videoGridItem:{width:"33.333%",height:155,padding:1},
  videoGridPlaceholder:{flex:1,backgroundColor:"#171725",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  videoGridThumbnail:{...StyleSheet.absoluteFillObject,width:"100%",height:"100%",resizeMode:"cover"},
  videoGridNoThumbnail:{...StyleSheet.absoluteFillObject,backgroundColor:"#25253a"},
  videoGridOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.28)",alignItems:"center",justifyContent:"center",padding:5},
  videoGridPlay:{color:C.white,fontSize:27,textShadowColor:"#000",textShadowRadius:5},
  videoGridCaption:{color:C.white,fontSize:9,textAlign:"center",marginTop:5},
  videoGridViews:{color:C.magenta,fontSize:9,marginTop:4},
  videoGridViewBadge:{position:"absolute",left:6,bottom:6,backgroundColor:"rgba(0,0,0,0.48)",paddingHorizontal:5,paddingVertical:3,borderRadius:8},
  videoGridViewText:{color:C.white,fontSize:9,fontWeight:"800"},
  emptyProfileVideos:{alignItems:"center",justifyContent:"center",padding:35,minHeight:220},
  emptyProfileTitle:{color:C.white,fontSize:17,fontWeight:"900",marginTop:12,marginBottom:5},
  backText:{color:C.magenta,fontSize:18,fontWeight:"800",marginBottom:15},
  editCoverPreview:{height:130,width:"100%",backgroundColor:C.card2,borderRadius:12,overflow:"hidden",alignItems:"center",justifyContent:"center"},
  editCoverImage:{width:"100%",height:"100%",resizeMode:"cover"},
  imagePickerText:{color:C.white,fontWeight:"700"},
  editAvatarPreview:{width:112,height:112,borderRadius:56,backgroundColor:C.card2,borderWidth:2,borderColor:C.magenta,alignItems:"center",justifyContent:"center",overflow:"hidden",alignSelf:"center"},
  editAvatarImage:{width:"100%",height:"100%",resizeMode:"cover"},
  soundHero:{backgroundColor:"#21172d",borderRadius:22,padding:23,alignItems:"center",marginVertical:18,borderWidth:1,borderColor:"#59304f"},
  soundTitle:{color:C.white,fontSize:22,fontWeight:"900",marginTop:20,textAlign:"center"},
  soundCreator:{color:C.gray,marginTop:6,marginBottom:12},
  soundCreatorRow:{flexDirection:"row",alignItems:"center",justifyContent:"center"},
  soundCreatorAvatar:{width:25,height:25,borderRadius:13,marginRight:7},
  soundVideoRow:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:13,padding:12,marginTop:9,gap:12},
  exploreRow:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:14,padding:10,marginTop:10,gap:12},
  friendsHeader:{height:58,backgroundColor:C.bg,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:17,borderBottomWidth:1,borderBottomColor:"#29283a"},
  friendsContent:{paddingBottom:24},
  friendsSectionTitle:{color:C.white,fontSize:17,fontWeight:"900",paddingHorizontal:15,paddingTop:17,paddingBottom:10},
  friendAvatarsRow:{paddingHorizontal:12,gap:13,alignItems:"flex-start"},
  friendAvatarItem:{width:68,alignItems:"center"},
  friendAvatarRing:{width:60,height:60,borderRadius:30,borderWidth:2,borderColor:C.magenta,backgroundColor:C.card2,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  friendAvatarImage:{width:"100%",height:"100%",borderRadius:30},
  friendAvatarFallback:{fontSize:28},
  friendAvatarName:{color:C.white,fontSize:10,marginTop:5,maxWidth:66},
  friendReelCard:{height:560,marginHorizontal:9,marginTop:10,borderRadius:16,overflow:"hidden",backgroundColor:"#000"},
  friendsEmpty:{alignItems:"center",justifyContent:"center",padding:28,minHeight:210},
  exploreThumb:{width:65,height:75,borderRadius:10,alignItems:"center",justifyContent:"center"},
  exploreMusic:{color:C.magenta,fontSize:11,marginTop:5},
  settingRow:{flexDirection:"row",alignItems:"center",paddingVertical:15,borderBottomWidth:1,borderBottomColor:"#333044"},
  settingIcon:{fontSize:19,width:38},
  settingTitle:{color:C.white,flex:1,fontWeight:"700"},
  settingArrow:{color:C.gray,fontSize:23},
  logoutButton:{marginTop:22,backgroundColor:"#3a1c2b",borderRadius:12,padding:15,alignItems:"center"},
  logoutText:{color:"#ff6b87",fontSize:15,fontWeight:"900"},
  accountCard:{flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderWidth:1,borderColor:"#49304e",borderRadius:17,padding:15,marginTop:15},
  settingsAvatar:{width:60,height:60,borderRadius:30,borderWidth:2,borderColor:C.pink,backgroundColor:C.card2,justifyContent:"center",alignItems:"center",marginRight:14},
  accountName:{color:C.white,fontSize:16,fontWeight:"bold"},
  accountEmail:{color:C.gray,fontSize:11,marginTop:5},
  centerPage:{flex:1,backgroundColor:C.bg,alignItems:"center",justifyContent:"center",padding:25},
  playerScreen:{flex:1,backgroundColor:"#000",overflow:"hidden"},
  playerViewsBar:{height:58,backgroundColor:"#050505",paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  playerViewsText:{color:"#bfc0c8",fontSize:14,fontWeight:"700"},
  playerInsightsButton:{backgroundColor:"#292932",borderRadius:22,paddingHorizontal:15,paddingVertical:10},
  playerInsightsText:{color:C.white,fontSize:13,fontWeight:"700"},
  playerBackOverlay:{position:"absolute",top:12,left:14,width:42,height:42,zIndex:20,justifyContent:"center",alignItems:"center",backgroundColor:"rgba(0,0,0,0.18)",borderRadius:22},
  playerBackOverlayText:{color:C.white,fontSize:34,fontWeight:"300",lineHeight:38},
  repostAttribution:{color:C.magenta,fontSize:11,fontWeight:"800",marginBottom:5},
  inboxPage:{flex:1,backgroundColor:C.bg},
  inboxHeader:{height:66,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  inboxHeaderAction:{width:42,height:42,alignItems:"center",justifyContent:"center"},
  inboxHeaderIcon:{color:C.white,fontSize:29,fontWeight:"800"},
  inboxHeaderCenter:{flexDirection:"row",alignItems:"center",gap:9},
  inboxStatus:{flexDirection:"row",alignItems:"center",gap:5,backgroundColor:C.card,borderRadius:12,paddingHorizontal:8,paddingVertical:5},
  inboxStatusDot:{width:8,height:8,borderRadius:4,backgroundColor:"#28d17c"},
  inboxStatusText:{color:C.gray,fontSize:10,fontWeight:"700"},
  inboxBack:{color:C.magenta,fontSize:34,marginRight:14},
  inboxTitle:{color:C.white,fontSize:21,fontWeight:"900"},
  inboxList:{paddingBottom:28},
  inboxSearchWrap:{marginHorizontal:16,marginBottom:10,flexDirection:"row",alignItems:"center",backgroundColor:C.card,borderRadius:13,paddingHorizontal:12},
  inboxSearchInput:{flex:1,color:C.white,paddingVertical:11,fontSize:14},
  inboxSearchClose:{color:C.gray,fontSize:18,padding:8},
  inboxPeopleSection:{paddingTop:10,paddingBottom:16},
  inboxPeopleHeading:{paddingHorizontal:18,flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},
  inboxSectionTitle:{color:C.white,fontSize:15,fontWeight:"900"},
  inboxSectionHint:{color:C.gray,fontSize:11},
  inboxPeopleRow:{paddingHorizontal:14,gap:13},
  inboxPersonItem:{width:76,alignItems:"center"},
  inboxCreateCircle:{width:62,height:62,borderRadius:31,backgroundColor:C.card2,borderWidth:1.5,borderColor:C.magenta,alignItems:"center",justifyContent:"center"},
  inboxCreatePlus:{color:C.magenta,fontSize:34,lineHeight:38},
  inboxStoryRing:{width:68,height:68,borderRadius:34,borderWidth:2.5,borderColor:C.magenta,alignItems:"center",justifyContent:"center"},
  inboxPersonAvatar:{width:58,height:58,borderRadius:29,backgroundColor:C.card2,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  inboxPersonAvatarImage:{width:58,height:58,borderRadius:29},
  inboxPersonFallback:{fontSize:23},
  inboxPersonName:{color:C.white,fontSize:11,fontWeight:"700",marginTop:7,maxWidth:74,textAlign:"center"},
  inboxFilters:{flexDirection:"row",alignItems:"center",paddingHorizontal:14,paddingVertical:12,gap:8,borderBottomWidth:1,borderBottomColor:"#302b40"},
  inboxFilterChip:{backgroundColor:C.card,borderRadius:13,paddingHorizontal:16,paddingVertical:10},
  inboxFilterActive:{backgroundColor:"#263c4b"},
  inboxFilterText:{color:C.white,fontSize:13,fontWeight:"700"},
  inboxFilterTextActive:{color:"#67d7f0"},
  inboxFilterIcon:{marginLeft:"auto",width:38,height:38,alignItems:"center",justifyContent:"center"},
  inboxFilterIconText:{color:C.white,fontSize:25},
  inboxRequestRow:{flexDirection:"row",alignItems:"flex-start",paddingHorizontal:17,paddingVertical:14,borderBottomWidth:1,borderBottomColor:"#242032",gap:12},
  inboxRequestActions:{flexDirection:"row",gap:9,marginTop:10},
  inboxAcceptButton:{backgroundColor:C.magenta,borderRadius:9,paddingHorizontal:15,paddingVertical:8},
  inboxAcceptText:{color:"#fff",fontSize:12,fontWeight:"900"},
  inboxIgnoreButton:{backgroundColor:C.card2,borderRadius:9,paddingHorizontal:15,paddingVertical:8},
  inboxIgnoreText:{color:C.white,fontSize:12,fontWeight:"800"},
  inboxChatRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:17,paddingVertical:14,borderBottomWidth:1,borderBottomColor:"#242032",gap:12},
  inboxAvatar:{width:58,height:58,borderRadius:29,backgroundColor:C.card2,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  inboxAvatarImage:{width:58,height:58,borderRadius:29},
  inboxChatName:{color:C.white,fontSize:15,fontWeight:"800"},
  inboxPreview:{color:C.gray,fontSize:12,marginTop:5},
  inboxChatMeta:{alignItems:"flex-end",gap:7},
  inboxUnreadDot:{width:9,height:9,borderRadius:5,backgroundColor:C.magenta},
  inboxTime:{color:C.gray,fontSize:10},
  inboxEmpty:{alignItems:"center",paddingHorizontal:28,paddingVertical:55},
  inboxEmptyIcon:{color:C.magenta,fontSize:42,marginBottom:10},
  inboxEmptyTitle:{color:C.white,fontSize:16,fontWeight:"900"},
  inboxEmptyText:{color:C.gray,fontSize:12,textAlign:"center",marginTop:7,lineHeight:18},
  inboxChatRow:{flexDirection:"row",alignItems:"center",paddingVertical:13,borderBottomWidth:1,borderBottomColor:"#302b40",gap:12},
  inboxAvatar:{width:46,height:46,borderRadius:23,backgroundColor:C.card2,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  inboxAvatarImage:{width:46,height:46,borderRadius:23},
  inboxChatName:{color:C.white,fontSize:14,fontWeight:"800"},
  inboxPreview:{color:C.gray,fontSize:12,marginTop:5},
  inboxTime:{color:C.gray,fontSize:10},
  messageList:{flex:1},
  messageListContent:{padding:14,gap:12,flexGrow:1,justifyContent:"flex-end"},
  messageBubble:{maxWidth:"88%",padding:11,borderRadius:15},
  myMessageBubble:{alignSelf:"flex-end",backgroundColor:"#472044"},
  theirMessageBubble:{alignSelf:"flex-start",backgroundColor:C.card},
  messageVideoCard:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#161622",borderRadius:11,padding:10,minWidth:210},
  messageVideoIcon:{color:C.magenta,fontSize:25},
  messageVideoCreator:{color:C.white,fontWeight:"900",fontSize:12},
  messageVideoCaption:{color:C.gray,fontSize:11,marginTop:4},
  messageText:{color:C.white,fontSize:14,marginTop:7},
  messageTime:{color:"#aaa",fontSize:9,textAlign:"right",marginTop:7},
  messageComposer:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:9,borderTopWidth:1,borderTopColor:"#302b40",gap:8},
  messageComposerInput:{flex:1,minHeight:42,maxHeight:100,backgroundColor:C.card,borderRadius:20,paddingHorizontal:14,paddingVertical:9,color:C.white,fontSize:14},
  messageSendButton:{backgroundColor:"#d92f4b",borderRadius:18,paddingHorizontal:15,paddingVertical:11},
  messageSendText:{color:C.white,fontSize:12,fontWeight:"900"},
  shareModalRoot:{flex:1,justifyContent:"flex-end"},
  shareBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:"rgba(0,0,0,0.65)"},
  shareSheet:{backgroundColor:C.bg,borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,paddingBottom:28,height:"88%",maxHeight:"88%"},
  shareSheetScroll:{flex:1},
  shareSheetScrollContent:{flexGrow:1,paddingBottom:32},
  shareSheetHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},
  shareSheetTitle:{color:C.white,fontSize:19,fontWeight:"900"},
  shareClose:{color:C.white,fontSize:30},
  recipientRow:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#302b40",gap:10},
  recipientName:{color:C.white,fontSize:14,fontWeight:"700",flex:1},
  recipientSend:{color:C.magenta,fontSize:13,fontWeight:"900"}
});
